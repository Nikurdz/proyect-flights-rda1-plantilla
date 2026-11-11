import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import { Vuelo } from '../../entities/vuelo.entity';
import { Localidad } from '../catalogo/entities/localidad.entity';
import { escapeLike, normalizarTexto } from '../common/texto.util';
import { AuditoriaCambio } from '../mercados/entities/auditoria-cambio.entity';
import { AdminAeropuertoViewDto, AdminAeropuertosQueryDto, AdminCrearAeropuertoDto } from './admin-aeropuertos.dto';

const isTimeZone = (zone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

/**
 * Airport catalogue management of the ADMIN: list and create. A code, once created, is referenced by flights (a foreign
 * key that restricts deletion), so there is no edit or delete here; creation is deliberate and needs `confirmar: true`.
 */
@Injectable()
export class AeropuertosAdminService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async listar(query: AdminAeropuertosQueryDto) {
    const limite = query.limite ?? 25;
    const pagina = query.pagina ?? 1;
    const qb = this.dataSource.manager.createQueryBuilder(Localidad, 'l');
    const key = normalizarTexto(query.q ?? '');
    if (key !== '') {
      qb.andWhere('(LOWER(l.iata) LIKE :p OR l.ciudadNorm LIKE :p OR l.nombreNorm LIKE :p)', { p: `%${escapeLike(key)}%` });
    }
    if (query.pais) qb.andWhere('l.pais = :pais', { pais: query.pais });
    const [rows, total] = await qb
      .orderBy('l.paisNombre', 'ASC')
      .addOrderBy('l.ciudad', 'ASC')
      .addOrderBy('l.iata', 'ASC')
      .skip((pagina - 1) * limite)
      .take(limite)
      .getManyAndCount();

    const flights = await this.flightsPerAirport(this.dataSource.manager, rows.map((r) => r.iata));
    return { items: rows.map((r) => view(r, flights.get(r.iata) ?? 0)), total, pagina, limite };
  }

  async crear(actorId: string, dto: AdminCrearAeropuertoDto): Promise<AdminAeropuertoViewDto> {
    if (dto.confirmar !== true) {
      throw new ProblemDetailsException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'VALIDATION_FAILED',
        'Confirmation required',
        'Creating an airport needs the explicit confirmation of the administrator: send confirmar: true.',
        [{ name: 'confirmar', reason: 'must be true to create the airport' }],
      );
    }
    const zonaHoraria = dto.zonaHoraria.trim();
    if (!isTimeZone(zonaHoraria)) {
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Unknown time zone', `"${zonaHoraria}" is not an IANA time zone (for example America/Guayaquil).`, [
        { name: 'zonaHoraria', reason: 'not an IANA time zone' },
      ]);
    }
    const ciudad = dto.ciudad.trim();
    const nombre = dto.nombre.trim();
    const paisNombre = dto.paisNombre.trim();
    if (!ciudad || !nombre || !paisNombre) {
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Empty text', 'City, airport and country names cannot be blank.', [{ name: !ciudad ? 'ciudad' : !nombre ? 'nombre' : 'paisNombre', reason: 'must not be blank' }]);
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        if (await manager.existsBy(Localidad, { iata: dto.iata })) throw this.duplicate(dto.iata);
        const saved = await manager.save(
          manager.create(Localidad, { iata: dto.iata, ciudad, nombre, pais: dto.pais, paisNombre, zonaHoraria, ciudadNorm: normalizarTexto(ciudad), nombreNorm: normalizarTexto(nombre) }),
        );
        await manager.save(
          manager.create(AuditoriaCambio, {
            entidad: 'aeropuerto',
            entidadId: saved.iata,
            actorId,
            accion: 'CREAR',
            antes: {},
            despues: { iata: saved.iata, ciudad, nombre, pais: dto.pais, paisNombre, zonaHoraria },
          }),
        );
        return view(saved, 0);
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw this.duplicate(dto.iata); // two administrators at once
      throw error;
    }
  }

  private duplicate(iata: string): ProblemDetailsException {
    return new ProblemDetailsException(HttpStatus.CONFLICT, 'CONFLICT', 'Airport already exists', `The airport code ${iata} already exists.`);
  }

  private async flightsPerAirport(manager: EntityManager, codes: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (codes.length === 0) return counts;
    for (const column of ['origenIATA', 'destinoIATA'] as const) {
      const rows: { iata: string; n: string }[] = await manager
        .createQueryBuilder(Vuelo, 'v')
        .select(`v.${column}`, 'iata')
        .addSelect('COUNT(*)', 'n')
        .where(`v.${column} IN (:...codes)`, { codes })
        .groupBy(`v.${column}`)
        .getRawMany();
      for (const row of rows) counts.set(row.iata, (counts.get(row.iata) ?? 0) + Number(row.n));
    }
    return counts;
  }
}

const view = (l: Localidad, vuelos: number): AdminAeropuertoViewDto => ({ iata: l.iata, ciudad: l.ciudad, nombre: l.nombre, pais: l.pais, paisNombre: l.paisNombre, zonaHoraria: l.zonaHoraria, vuelos });
