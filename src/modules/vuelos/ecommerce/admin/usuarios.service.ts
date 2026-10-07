import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { toIso } from '../../common/date.util';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import { Cliente } from '../identidad/entities/cliente.entity';
import { IdentidadService } from '../identidad/identidad.service';
import { AuditoriaCambio } from '../mercados/entities/auditoria-cambio.entity';
import { AdminCambiarRolesDto, AdminCrearUsuarioDto, AdminUsuarioViewDto, AdminUsuariosPaginaDto, AdminUsuariosQueryDto } from './admin-usuarios.dto';

const sinCredenciales = (c: Cliente): AdminUsuarioViewDto => ({
  clienteId: c.clienteId,
  correo: c.correo,
  nombres: c.nombres,
  apellidos: c.apellidos,
  roles: c.roles,
  correoVerificado: c.correoVerificado,
  bloqueada: Boolean(c.bloqueadoHasta && c.bloqueadoHasta.getTime() > Date.now()),
  creadoEn: toIso(c.creadoEn),
});

/** Every account always keeps CUSTOMER; ADMIN is what an administrator adds. Order is fixed so equal sets compare equal. */
const normalizarRoles = (roles: string[]): string[] => ['CUSTOMER', ...(roles.includes('ADMIN') ? ['ADMIN'] : [])];

/**
 * User management for the back office: list, create (with any role) and promote or demote. Every change is
 * recorded in the append-only audit trail. Credentials (hash, tokens) never leave this service.
 */
@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Cliente) private readonly clientes: Repository<Cliente>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly identidad: IdentidadService,
  ) {}

  async listar(query: AdminUsuariosQueryDto): Promise<AdminUsuariosPaginaDto> {
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 25;
    const qb = this.clientes.createQueryBuilder('c');
    if (query.q) {
      qb.andWhere('(c."correo" ILIKE :q OR c."nombres" ILIKE :q OR c."apellidos" ILIKE :q)', { q: `%${query.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%` });
    }
    if (query.rol) qb.andWhere(':rol = ANY(c."roles")', { rol: query.rol });
    const [rows, total] = await qb
      .orderBy('c."creadoEn"', 'DESC')
      .addOrderBy('c."clienteId"', 'ASC')
      .skip((pagina - 1) * limite)
      .take(limite)
      .getManyAndCount();
    return { items: rows.map(sinCredenciales), total, pagina, limite };
  }

  async obtener(clienteId: string): Promise<AdminUsuarioViewDto> {
    return sinCredenciales(await this.requerir(clienteId));
  }

  async crear(actorId: string, dto: AdminCrearUsuarioDto): Promise<AdminUsuarioViewDto> {
    const roles = normalizarRoles(dto.roles ?? ['CUSTOMER']);
    const cliente = await this.identidad.crearCuenta({ ...dto, roles });
    await this.auditar(this.dataSource.manager, actorId, cliente.clienteId, 'CREAR', {}, { correo: cliente.correo, roles: cliente.roles });
    return sinCredenciales(cliente);
  }

  /** Sets the roles of an account. Refuses to strip ADMIN from oneself or from the last administrator. */
  async cambiarRoles(actorId: string, clienteId: string, dto: AdminCambiarRolesDto): Promise<AdminUsuarioViewDto> {
    const nuevos = normalizarRoles(dto.roles);
    const guardado = await this.dataSource.transaction(async (manager) => {
      const cliente = await manager.findOne(Cliente, { where: { clienteId }, lock: { mode: 'pessimistic_write' } });
      if (!cliente) throw this.noEncontrado(clienteId);

      const eraAdmin = cliente.roles.includes('ADMIN');
      const seraAdmin = nuevos.includes('ADMIN');
      if (eraAdmin && !seraAdmin) {
        if (cliente.clienteId === actorId) {
          throw new ProblemDetailsException(HttpStatus.CONFLICT, 'LAST_ADMIN', 'You cannot remove your own admin role', 'Ask another administrator to change your role.');
        }
        // Counted under lock so two administrators demoting each other at once cannot leave nobody in charge.
        const admins = await manager.createQueryBuilder(Cliente, 'c').select('c.clienteId').setLock('pessimistic_write').where("'ADMIN' = ANY(c.\"roles\")").getMany();
        if (admins.length <= 1) {
          throw new ProblemDetailsException(HttpStatus.CONFLICT, 'LAST_ADMIN', 'The last administrator cannot be demoted', 'There must always be at least one administrator.');
        }
      }

      const antes = { roles: cliente.roles };
      if (cliente.roles.join() !== nuevos.join()) {
        cliente.roles = nuevos;
        await manager.save(cliente);
        await this.auditar(manager, actorId, cliente.clienteId, seraAdmin && !eraAdmin ? 'ASCENDER' : eraAdmin && !seraAdmin ? 'DEGRADAR' : 'ACTUALIZAR_ROLES', antes, { roles: cliente.roles });
      }
      return cliente;
    });
    return sinCredenciales(guardado);
  }

  private async requerir(clienteId: string): Promise<Cliente> {
    const cliente = await this.clientes.findOne({ where: { clienteId } });
    if (!cliente) throw this.noEncontrado(clienteId);
    return cliente;
  }

  private noEncontrado(clienteId: string): ProblemDetailsException {
    return new ProblemDetailsException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'User not found', `No user ${clienteId}.`);
  }

  private auditar(manager: EntityManager, actorId: string, clienteId: string, accion: string, antes: unknown, despues: unknown) {
    return manager.save(manager.create(AuditoriaCambio, { entidad: 'usuario', entidadId: clienteId, actorId, accion, antes, despues }));
  }
}
