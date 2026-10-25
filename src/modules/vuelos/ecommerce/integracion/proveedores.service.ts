import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { DomainEventBus } from '../../common/domain-event-bus';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import { UnsafeUrlError } from '../../common/safe-http';
import { AuditoriaCambio } from '../mercados/entities/auditoria-cambio.entity';
import type { AdaptadorProveedor } from './acl/adaptador-proveedor';
import { AtraccionesAdapter } from './acl/atracciones.adapter';
import { CircuitBreakers, EstadoCircuito } from './acl/circuit-breakers.service';
import { ClienteProveedor } from './acl/cliente-proveedor';
import { SondaAdapter } from './acl/sonda.adapter';
import { CatalogoExterno, CatalogoExternoCategoria } from './entities/catalogo-externo.entity';
import { EstadoSalud, ProveedorSalud } from './entities/proveedor-salud.entity';
import { Proveedor, TipoServicio } from './entities/proveedor.entity';
import { ReservaExterna } from './entities/reserva-externa.entity';

/** Above this a provider that answers is shown as slow (amber light). */
export const LATENCIA_LENTA_MS = 1500;

export interface SaludActual {
  estado: EstadoSalud | 'SIN_DATOS' | 'APAGADO';
  latenciaMs: number | null;
  detalle: string | null;
  comprobadoEn: Date | null;
}

export interface ProveedorVista {
  id: string;
  nombre: string;
  equipo: string;
  baseUrl: string;
  tipoServicio: TipoServicio;
  activo: boolean;
  salud: SaludActual;
  circuito: EstadoCircuito;
  productos: number;
}

const notFound = (id: string) => new ProblemDetailsException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Provider not found', `No provider ${id}.`);

/**
 * Normalises the address a team types in: no trailing slash, and the API version prefix added when it was left out
 * ("https://host" and "https://host/api/v2" register the same service).
 */
export function normalizarBaseUrl(raw: string): string {
  const url = new URL(raw.trim());
  let path = url.pathname.replace(/\/+$/, '');
  if (!/\/api\/v\d+$/i.test(path)) path += '/api/v2';
  return `${url.protocol}//${url.host}${path}`;
}

/**
 * Gestión de Proveedores: registers partner services, watches their health, imports their catalogue and applies the
 * kill-switch. Every call to a partner goes through its anti-corruption adapter and its circuit breaker.
 */
@Injectable()
export class ProveedoresService {
  private readonly sonda = new Map<TipoServicio, AdaptadorProveedor>();

  constructor(
    @InjectRepository(Proveedor) private readonly proveedores: Repository<Proveedor>,
    @InjectRepository(ProveedorSalud) private readonly salud: Repository<ProveedorSalud>,
    @InjectRepository(CatalogoExterno) private readonly catalogo: Repository<CatalogoExterno>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cliente: ClienteProveedor,
    private readonly circuitos: CircuitBreakers,
    private readonly events: DomainEventBus,
    atracciones: AtraccionesAdapter,
  ) {
    this.sonda.set('ATRACCIONES', atracciones);
    this.sonda.set('AUTOS', new SondaAdapter('AUTOS', cliente));
    this.sonda.set('ALOJAMIENTOS', new SondaAdapter('ALOJAMIENTOS', cliente));
  }

  adaptador(tipo: TipoServicio): AdaptadorProveedor {
    return this.sonda.get(tipo)!;
  }

  async listar(): Promise<ProveedorVista[]> {
    const filas = await this.proveedores.find({ order: { creadoEn: 'ASC' } });
    return this.vistas(filas);
  }

  async obtener(id: string): Promise<ProveedorVista> {
    return (await this.vistas([await this.requerir(id)]))[0];
  }

  async requerir(id: string): Promise<Proveedor> {
    const proveedor = /^[0-9a-f-]{36}$/i.test(id) ? await this.proveedores.findOneBy({ id }) : null;
    if (!proveedor) throw notFound(id);
    return proveedor;
  }

  async crear(actorId: string, dto: { nombre: string; equipo: string; baseUrl: string; tipoServicio: TipoServicio }): Promise<ProveedorVista> {
    const baseUrl = await this.validarUrl(dto.baseUrl);
    if (await this.proveedores.existsBy({ nombre: dto.nombre.trim() })) {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'CONFLICT', 'Provider already registered', `There is already a provider named "${dto.nombre.trim()}".`);
    }
    const creado = await this.dataSource.transaction(async (manager) => {
      const proveedor = await manager.save(manager.create(Proveedor, { nombre: dto.nombre.trim(), equipo: dto.equipo.trim(), baseUrl, tipoServicio: dto.tipoServicio, activo: true }));
      await this.auditar(manager, actorId, proveedor.id, 'CREAR', {}, { nombre: proveedor.nombre, baseUrl, tipoServicio: proveedor.tipoServicio });
      return proveedor;
    });
    await this.events.publish('proveedor.registrado', creado.id, { proveedorId: creado.id, tipoServicio: creado.tipoServicio });
    return (await this.vistas([creado]))[0];
  }

  async actualizar(actorId: string, id: string, dto: { nombre?: string; equipo?: string; baseUrl?: string; activo?: boolean }): Promise<ProveedorVista> {
    const baseUrl = dto.baseUrl !== undefined ? await this.validarUrl(dto.baseUrl) : undefined;
    const actualizado = await this.dataSource.transaction(async (manager) => {
      const proveedor = await manager.findOne(Proveedor, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!proveedor) throw notFound(id);
      const antes = { nombre: proveedor.nombre, equipo: proveedor.equipo, baseUrl: proveedor.baseUrl, activo: proveedor.activo };
      if (dto.nombre !== undefined && dto.nombre.trim() !== proveedor.nombre) {
        if (await manager.existsBy(Proveedor, { nombre: dto.nombre.trim() })) {
          throw new ProblemDetailsException(HttpStatus.CONFLICT, 'CONFLICT', 'Provider already registered', `There is already a provider named "${dto.nombre.trim()}".`);
        }
        proveedor.nombre = dto.nombre.trim();
      }
      if (dto.equipo !== undefined) proveedor.equipo = dto.equipo.trim();
      if (baseUrl !== undefined) proveedor.baseUrl = baseUrl;
      if (dto.activo !== undefined) proveedor.activo = dto.activo;
      await manager.save(proveedor);
      const despues = { nombre: proveedor.nombre, equipo: proveedor.equipo, baseUrl: proveedor.baseUrl, activo: proveedor.activo };
      const accion = dto.activo !== undefined && dto.activo !== antes.activo ? (dto.activo ? 'ACTIVAR' : 'APAGAR') : 'ACTUALIZAR';
      await this.auditar(manager, actorId, id, accion, antes, despues);
      return { proveedor, accion };
    });
    if (actualizado.accion === 'ACTIVAR') this.circuitos.reiniciar(id);
    if (actualizado.accion !== 'ACTUALIZAR') {
      await this.events.publish(actualizado.accion === 'APAGAR' ? 'proveedor.apagado' : 'proveedor.activado', id, { proveedorId: id });
    }
    return (await this.vistas([actualizado.proveedor]))[0];
  }

  /** Deleting a provider that has sold something would orphan the reservations: switch it off instead. */
  async eliminar(actorId: string, id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const proveedor = await manager.findOne(Proveedor, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!proveedor) throw notFound(id);
      if ((await manager.countBy(ReservaExterna, { proveedorId: id })) > 0) {
        throw new ProblemDetailsException(HttpStatus.CONFLICT, 'PROVIDER_IN_USE', 'Provider has reservations', 'Reservations were made through this provider. Switch it off instead of deleting it.');
      }
      await manager.delete(Proveedor, { id }); // its catalogue and health history go with it
      await this.auditar(manager, actorId, id, 'ELIMINAR', { nombre: proveedor.nombre, baseUrl: proveedor.baseUrl }, {});
    });
    this.circuitos.olvidar(id);
  }

  /** 🔄 Checks the service now: records the result and returns the light (UP, slow or DOWN) with its latency. */
  async ping(id: string): Promise<SaludActual> {
    const proveedor = await this.requerir(id);
    if (!proveedor.activo) {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'PROVIDER_DISABLED', 'Provider is switched off', 'Switch the provider on before checking it.');
    }
    return this.comprobar(proveedor);
  }

  /** Checks one active provider and records the result. Used by the manual ping and by the health job. */
  async comprobar(proveedor: Proveedor): Promise<SaludActual> {
    const adaptador = this.adaptador(proveedor.tipoServicio);
    let estado: EstadoSalud;
    let latenciaMs: number | null = null;
    let detalle: string | null = null;
    try {
      latenciaMs = await this.circuitos.ejecutar(proveedor.id, () => adaptador.ping(proveedor.baseUrl));
      estado = latenciaMs > LATENCIA_LENTA_MS ? 'DEGRADADO' : 'UP';
      if (estado === 'DEGRADADO') detalle = `slow answer (${latenciaMs} ms)`;
    } catch (error) {
      estado = 'DOWN';
      detalle = (error instanceof ProblemDetailsException ? (error.getResponse() as { detail?: string }).detail : error instanceof Error ? error.message : String(error))?.slice(0, 200) ?? null;
    }
    const comprobadoEn = new Date();
    const anterior = await this.ultimaSalud(proveedor.id);
    await this.salud.insert({ proveedorId: proveedor.id, estado, latenciaMs, detalle, comprobadoEn });
    if (anterior?.estado !== estado) {
      await this.events.publish('proveedor.salud', proveedor.id, { proveedorId: proveedor.id, estado, anterior: anterior?.estado ?? 'SIN_DATOS' });
    }
    return { estado, latenciaMs, detalle, comprobadoEn };
  }

  /** 📥 Imports the partner catalogue into the local cache the customers browse. */
  async sincronizar(actorId: string, id: string, maxItems: number): Promise<{ importados: number; nuevos: number; actualizados: number; desactivados: number }> {
    const proveedor = await this.requerir(id);
    if (!proveedor.activo) {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'PROVIDER_DISABLED', 'Provider is switched off', 'Switch the provider on before synchronising it.');
    }
    const adaptador = this.adaptador(proveedor.tipoServicio);
    const productos = await this.circuitos.ejecutar(id, () => adaptador.catalogo(proveedor.baseUrl, maxItems));

    const resultado = await this.dataSource.transaction(async (manager) => {
      const ahora = new Date();
      const existentes = await manager.find(CatalogoExterno, { where: { proveedorId: id }, relations: { categorias: true } });
      const porId = new Map(existentes.map((c) => [c.externalId, c]));
      let nuevos = 0;
      let actualizados = 0;
      for (const p of productos) {
        const actual = porId.get(p.externalId);
        const campos = { tipo: p.tipo, nombre: p.nombre, descripcion: p.descripcion, duracion: p.duracion, precioMinor: p.precioMinor, moneda: p.moneda, imagenUrl: p.imagenUrl, cancelacionGratis: p.cancelacionGratis, activo: true, sincronizadoEn: ahora };
        if (actual) {
          await manager.update(CatalogoExterno, { id: actual.id }, campos);
          await manager.delete(CatalogoExternoCategoria, { catalogoId: actual.id });
          if (p.categorias.length) await manager.insert(CatalogoExternoCategoria, p.categorias.map((categoria) => ({ catalogoId: actual.id, categoria })));
          actualizados++;
        } else {
          await manager.save(manager.create(CatalogoExterno, { ...campos, proveedorId: id, externalId: p.externalId, categorias: p.categorias.map((categoria) => manager.create(CatalogoExternoCategoria, { categoria })) }));
          nuevos++;
        }
      }
      // What the partner no longer lists stays on record (reservations point at it) but is hidden.
      const vigentes = new Set(productos.map((p) => p.externalId));
      const retirados = existentes.filter((c) => c.activo && !vigentes.has(c.externalId)).map((c) => c.id);
      if (retirados.length) await manager.update(CatalogoExterno, { id: In(retirados) }, { activo: false });
      await this.auditar(manager, actorId, id, 'SINCRONIZAR', {}, { importados: productos.length, nuevos, actualizados, desactivados: retirados.length });
      return { importados: productos.length, nuevos, actualizados, desactivados: retirados.length };
    });
    await this.events.publish('proveedor.sincronizado', id, { proveedorId: id, ...resultado });
    return resultado;
  }

  async historialSalud(id: string, limite = 50): Promise<SaludActual[]> {
    await this.requerir(id);
    const filas = await this.salud.find({ where: { proveedorId: id }, order: { comprobadoEn: 'DESC' }, take: Math.min(limite, 200) });
    return filas.map((f) => ({ estado: f.estado, latenciaMs: f.latenciaMs, detalle: f.detalle, comprobadoEn: f.comprobadoEn }));
  }

  async ultimaSalud(proveedorId: string): Promise<ProveedorSalud | null> {
    return this.salud.findOne({ where: { proveedorId }, order: { comprobadoEn: 'DESC', id: 'DESC' } });
  }

  private async vistas(proveedores: Proveedor[]): Promise<ProveedorVista[]> {
    return Promise.all(
      proveedores.map(async (p) => {
        const ultima = await this.ultimaSalud(p.id);
        const productos = await this.catalogo.countBy({ proveedorId: p.id, activo: true });
        const salud: SaludActual = !p.activo
          ? { estado: 'APAGADO', latenciaMs: null, detalle: 'switched off', comprobadoEn: ultima?.comprobadoEn ?? null }
          : ultima
            ? { estado: ultima.estado, latenciaMs: ultima.latenciaMs, detalle: ultima.detalle, comprobadoEn: ultima.comprobadoEn }
            : { estado: 'SIN_DATOS', latenciaMs: null, detalle: null, comprobadoEn: null };
        return { id: p.id, nombre: p.nombre, equipo: p.equipo, baseUrl: p.baseUrl, tipoServicio: p.tipoServicio, activo: p.activo, salud, circuito: this.circuitos.estado(p.id), productos };
      }),
    );
  }

  private async validarUrl(raw: string): Promise<string> {
    let normalizada: string;
    try {
      normalizada = normalizarBaseUrl(raw);
      await this.cliente.validarUrl(normalizada);
    } catch (error) {
      const motivo = error instanceof UnsafeUrlError ? error.message : 'the URL is not valid';
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Provider URL not accepted', `The provider URL was rejected: ${motivo}.`, [{ name: 'baseUrl', reason: motivo }]);
    }
    return normalizada;
  }

  private auditar(manager: EntityManager, actorId: string, entidadId: string, accion: string, antes: unknown, despues: unknown) {
    return manager.save(manager.create(AuditoriaCambio, { entidad: 'proveedor', entidadId, actorId, accion, antes, despues }));
  }
}
