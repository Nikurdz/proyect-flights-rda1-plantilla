import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DomainEventBus } from '../../common/domain-event-bus';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import { convertFromUsd, minorDigits } from '../common/moneda.util';
import { ActualizarMercadoDto, MercadoViewDto } from './dto/mercado.dto';
import { AuditoriaCambio } from './entities/auditoria-cambio.entity';
import { Mercado } from './entities/mercado.entity';

const EDITABLE_FIELDS = ['nombre', 'tipoCambioDesdeUsd', 'activo', 'productosBuscador', 'mediosPago', 'reglasRegulatorias', 'textosLegales', 'identificacionesFiscales'] as const;

/**
 * D02: every market-dependent decision (currency, payment methods, legal texts, regulatory
 * windows, which products show) is read from here — RN-02: resolved by market, never coded.
 */
@Injectable()
export class MercadosService {
  constructor(
    @InjectRepository(Mercado) private readonly mercados: Repository<Mercado>,
    @InjectRepository(AuditoriaCambio) private readonly auditoria: Repository<AuditoriaCambio>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly events: DomainEventBus,
  ) {}

  async obtener(codigo: string): Promise<Mercado> {
    const mercado = await this.mercados.findOne({ where: { codigo } });
    if (!mercado) {
      throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'MARKET_NOT_AVAILABLE', 'Market not found', `There is no market "${codigo}".`);
    }
    return mercado;
  }

  /** The market a transaction runs in must be live (RN-01 fixes it at the start of the purchase). */
  async requerirActivo(codigo: string): Promise<Mercado> {
    const mercado = await this.obtener(codigo);
    if (!mercado.activo) {
      throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'MARKET_NOT_AVAILABLE', 'Market not available', `The market "${codigo}" is not open for sales.`);
    }
    return mercado;
  }

  /** Converts an inventory price (USD cents) into minor units of the market currency (RN-01). */
  convertirDesdeUsd(mercado: Mercado, usdCents: number): number {
    return convertFromUsd(usdCents, mercado.tipoCambioDesdeUsd, mercado.moneda);
  }

  vista(mercado: Mercado): MercadoViewDto {
    return {
      codigo: mercado.codigo,
      pais: mercado.pais,
      nombre: mercado.nombre,
      idiomas: mercado.idiomas,
      idiomaPorDefecto: mercado.idiomaPorDefecto,
      moneda: mercado.moneda,
      decimalesMoneda: minorDigits(mercado.moneda),
      productosBuscador: mercado.productosBuscador,
      mediosPago: mercado.mediosPago,
      reglasRegulatorias: mercado.reglasRegulatorias,
      textosLegales: mercado.textosLegales,
      identificacionesFiscales: mercado.identificacionesFiscales,
      activo: mercado.activo,
      version: mercado.version,
    };
  }

  async obtenerVista(codigo: string): Promise<MercadoViewDto> {
    return this.vista(await this.obtener(codigo));
  }

  /** RF-ADM-001/006: an audited, optimistic-locked configuration edit. */
  async actualizar(actorId: string, codigo: string, cambios: ActualizarMercadoDto): Promise<MercadoViewDto> {
    for (const identificacion of cambios.identificacionesFiscales ?? []) {
      try {
        new RegExp(identificacion.patron);
      } catch {
        throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid tax-id pattern', `The pattern for ${identificacion.tipo} is not a valid regular expression.`, [
          { name: 'identificacionesFiscales.patron', reason: 'not a valid regular expression' },
        ]);
      }
    }
    const updated = await this.dataSource.transaction(async (manager) => {
      const actual = await manager.findOne(Mercado, { where: { codigo }, lock: { mode: 'pessimistic_write' } });
      if (!actual) {
        throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'MARKET_NOT_AVAILABLE', 'Market not found', `There is no market "${codigo}".`);
      }
      if (actual.version !== cambios.versionEsperada) {
        throw new ProblemDetailsException(
          HttpStatus.CONFLICT,
          'CONFLICT',
          'Market was modified by someone else',
          `The market is at version ${actual.version}, not ${cambios.versionEsperada}. Reload and reapply your change.`,
        );
      }

      const antes: Record<string, unknown> = {};
      const despues: Record<string, unknown> = {};
      for (const field of EDITABLE_FIELDS) {
        const value = cambios[field];
        if (value === undefined) continue;
        antes[field] = actual[field];
        despues[field] = value;
        (actual as unknown as Record<string, unknown>)[field] = value;
      }
      if (Object.keys(despues).length === 0) {
        throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Nothing to update', 'Send at least one field to change.');
      }

      actual.version += 1;
      const saved = await manager.save(actual);
      await manager.save(manager.create(AuditoriaCambio, { entidad: 'mercado', entidadId: codigo, actorId, accion: 'ACTUALIZAR', antes, despues }));
      return saved;
    });

    await this.events.publish('ConfiguracionMercadoPublicada', codigo, { codigo, version: updated.version }, { market: codigo });
    return this.vista(updated);
  }

  async listarAuditoria(entidad = 'mercado', entidadId?: string) {
    return this.auditoria.find({ where: { entidad, ...(entidadId ? { entidadId } : {}) }, order: { creadoEn: 'DESC' }, take: 100 });
  }
}
