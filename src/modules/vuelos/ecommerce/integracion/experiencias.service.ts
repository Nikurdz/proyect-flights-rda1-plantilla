import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import { money } from '../common/moneda.util';
import { ExperienciaViewDto, ExperienciasPaginaViewDto, ExperienciasQueryDto } from './dto/integracion.dto';
import { CatalogoExterno } from './entities/catalogo-externo.entity';

/** What customers browse: the synchronised partner catalogue, only from providers that are switched on. */
@Injectable()
export class ExperienciasService {
  constructor(@InjectRepository(CatalogoExterno) private readonly catalogo: Repository<CatalogoExterno>) {}

  async listar(query: ExperienciasQueryDto): Promise<ExperienciasPaginaViewDto> {
    const qb = this.catalogo
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.proveedor', 'p')
      .leftJoinAndSelect('c.categorias', 'k')
      .where('c.activo = true')
      .andWhere('p.activo = true');
    if (query.q) qb.andWhere('c.nombre ILIKE :q', { q: `%${query.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%` });
    const [filas, total] = await qb.orderBy('c.nombre', 'ASC').addOrderBy('c.id', 'ASC').skip(query.desde ?? 0).take(query.limite ?? 24).getManyAndCount();
    return { items: filas.map((f) => this.vista(f)), total };
  }

  async obtener(id: string): Promise<ExperienciaViewDto> {
    const fila = await this.catalogo.findOne({ where: { id, activo: true, proveedor: { activo: true } }, relations: { proveedor: true, categorias: true } });
    if (!fila) throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Experience not found', `No experience ${id}.`);
    return this.vista(fila);
  }

  private vista(c: CatalogoExterno): ExperienciaViewDto {
    return {
      id: c.id,
      proveedor: c.proveedor.nombre,
      tipo: c.tipo,
      nombre: c.nombre,
      descripcion: c.descripcion,
      duracion: c.duracion,
      precio: money(c.precioMinor, c.moneda),
      imagenUrl: c.imagenUrl,
      cancelacionGratis: c.cancelacionGratis,
      categorias: (c.categorias ?? []).map((k) => k.categoria).sort(),
    };
  }
}
