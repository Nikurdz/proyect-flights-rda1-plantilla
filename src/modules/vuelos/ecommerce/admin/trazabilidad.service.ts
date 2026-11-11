import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Brackets, DataSource, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { ecuadorDayRange } from '../../common/date.util';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import { COMPONENTES, ComponenteId, ENTIDADES_ADMIN, PASOS_SAGA, enlaceDeEvento, entradaDe, esRuidoDeProveedor } from '../../common/topologia';
import { AuditoriaCambio } from '../mercados/entities/auditoria-cambio.entity';
import { AuditoriaSaga, AuditoriaSagaPaso, AuditoriaTransaccion } from '../observabilidad/entities/auditoria.entity';
import { csvField } from './reservas-admin.service';
import { FlujoQueryDto, FuenteTraza, MapaQueryDto, TrazabilidadQueryDto } from './trazabilidad.dto';

const CSV_MAX = 5_000;
const FLUJO_MAX = 500;
/** Events that tell a step went wrong (red arrow). */
export const TIPOS_ERROR = new Set(['PagoRechazado', 'OrdenFallidaCompensada', 'booking.failed', 'booking.ticket_failed', 'pagos.payment.failed', 'CuentaBloqueada']);

export interface ItemTraza {
  fuente: FuenteTraza;
  id: string;
  en: string;
  correlationId: string | null;
  tipo: string;
  estado: 'OK' | 'ERROR' | 'COMPENSADA' | 'EN_CURSO';
  actorId: string | null;
  actorTipo: string | null;
  entidad: string | null;
  referencia: string | null;
  numero: string | null;
  origen: string | null;
  destino: string | null;
  resumen: string;
  pasos?: { secuencia: number; nombre: string; estado: string; detalle: string | null; duracionMs: number; en: string }[];
}

export interface AristaFlujo {
  orden: number;
  desde: ComponenteId;
  hasta: ComponenteId;
  etiqueta: string;
  fuente: FuenteTraza | 'solicitud';
  estado: 'OK' | 'ERROR' | 'COMPENSADA';
  ms: number | null;
  en: string;
  correlationId: string | null;
}

export interface NodoFlujo {
  id: ComponenteId;
  etiqueta: string;
  tipo: string;
}

const nodosDe = (ids: Set<string>): NodoFlujo[] => COMPONENTES.filter((c) => ids.has(c.id)).map((c) => ({ id: c.id, etiqueta: c.etiqueta, tipo: c.tipo }));

/**
 * The unified traceability of the system (ADMIN, read only): domain events, saga runs (with their steps) and
 * administrative changes in one timeline, plus the flow between components drawn from the same rows. Everything about the
 * partner-provider feature is left out (see `esRuidoDeProveedor`). It stores nothing: it reads what the trail recorded.
 */
@Injectable()
export class TrazabilidadService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async listar(query: TrazabilidadQueryDto): Promise<{ items: ItemTraza[]; siguiente: string | null }> {
    const limite = query.limite ?? 50;
    const items = await this.reunir(query, limite + 1);
    const pagina = items.slice(0, limite);
    return { items: pagina, siguiente: items.length > limite ? pagina[pagina.length - 1].en : null };
  }

  async exportCsv(query: TrazabilidadQueryDto): Promise<string> {
    const items = await this.reunir(query, CSV_MAX);
    const header = ['fecha', 'fuente', 'tipo', 'estado', 'correlationId', 'actorTipo', 'actorId', 'entidad', 'referencia', 'numero', 'origen', 'destino', 'resumen'];
    const body = items.map((i) => [i.en, i.fuente, i.tipo, i.estado, i.correlationId, i.actorTipo, i.actorId, i.entidad, i.referencia, i.numero, i.origen, i.destino, i.resumen].map(csvField).join(','));
    return String.fromCharCode(0xfeff) + [header.join(','), ...body].join('\r\n') + '\r\n';
  }

  /** The nodes and arrows of one request or purchase, in the order they happened. */
  async flujo(query: FlujoQueryDto): Promise<{ nodos: NodoFlujo[]; aristas: AristaFlujo[]; correlaciones: string[]; truncado: boolean }> {
    if (!query.correlationId && !query.numero) {
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Falta qué trazar', 'Indique correlationId o numero (orden o PNR).', [{ name: 'correlationId', reason: 'correlationId o numero es obligatorio' }]);
    }
    const items = await this.reunir({ correlationId: query.correlationId, numero: query.numero }, FLUJO_MAX + 1);
    const truncado = items.length > FLUJO_MAX;
    const ordenados = items.slice(0, FLUJO_MAX).sort((a, b) => a.en.localeCompare(b.en));
    const aristas: AristaFlujo[] = [];
    const vistas = new Set<string>();
    const push = (a: Omit<AristaFlujo, 'orden'>) => aristas.push({ ...a, orden: aristas.length + 1 });

    for (const item of ordenados) {
      // The caller enters through its own node the first time a request shows up.
      if (item.correlationId && item.actorTipo && item.actorTipo !== 'SYSTEM' && !vistas.has(item.correlationId)) {
        vistas.add(item.correlationId);
        push({ desde: entradaDe(item.actorTipo), hasta: 'api', etiqueta: 'Solicitud', fuente: 'solicitud', estado: 'OK', ms: null, en: item.en, correlationId: item.correlationId });
      }
      if (item.fuente === 'saga') {
        for (const paso of item.pasos ?? []) {
          const enlace = PASOS_SAGA[paso.nombre];
          if (!enlace) continue;
          push({ desde: enlace.origen, hasta: enlace.destino, etiqueta: paso.nombre, fuente: 'saga', estado: paso.estado === 'ERROR' ? 'ERROR' : paso.estado === 'COMPENSADO' ? 'COMPENSADA' : 'OK', ms: paso.duracionMs, en: paso.en, correlationId: item.correlationId });
        }
      } else if (item.fuente === 'admin') {
        push({ desde: 'admin', hasta: ENTIDADES_ADMIN[item.entidad ?? ''] ?? 'api', etiqueta: item.tipo, fuente: 'admin', estado: 'OK', ms: null, en: item.en, correlationId: item.correlationId });
      } else if (item.origen && item.destino) {
        push({ desde: item.origen as ComponenteId, hasta: item.destino as ComponenteId, etiqueta: item.tipo, fuente: 'evento', estado: item.estado === 'ERROR' ? 'ERROR' : 'OK', ms: null, en: item.en, correlationId: item.correlationId });
      }
    }
    return {
      nodos: nodosDe(new Set(aristas.flatMap((a) => [a.desde, a.hasta]))),
      aristas,
      correlaciones: [...new Set(ordenados.map((i) => i.correlationId).filter((c): c is string => !!c))],
      truncado,
    };
  }

  /** How many times each pair of components talked in a period (events and calls) and how many of those went wrong. */
  async mapa(query: MapaQueryDto): Promise<{ nodos: NodoFlujo[]; enlaces: { desde: string; hasta: string; total: number; errores: number }[] }> {
    const qb = this.dataSource
      .getRepository(AuditoriaTransaccion)
      .createQueryBuilder('t')
      .select('t.origen', 'origen')
      .addSelect('t.destino', 'destino')
      .addSelect('COUNT(*)', 'total')
      .addSelect(`SUM(CASE WHEN t.tipo IN (:...errores) OR t.resumen LIKE 'estado=ERROR%' THEN 1 ELSE 0 END)`, 'errores')
      .where('t.origen IS NOT NULL AND t.destino IS NOT NULL')
      .andWhere(`t.tipo NOT LIKE 'proveedor.%' AND t.tipo NOT LIKE 'ReservaExterna%'`)
      .setParameter('errores', [...TIPOS_ERROR])
      .groupBy('t.origen')
      .addGroupBy('t.destino');
    if (query.desde) qb.andWhere('t.ocurridoEn >= :desde', { desde: ecuadorDayRange(query.desde).start });
    if (query.hasta) qb.andWhere('t.ocurridoEn < :hasta', { hasta: ecuadorDayRange(query.hasta).end });
    const rows = await qb.getRawMany<{ origen: string; destino: string; total: string; errores: string }>();
    const enlaces = rows.map((r) => ({ desde: r.origen, hasta: r.destino, total: Number(r.total), errores: Number(r.errores) }));
    return { nodos: nodosDe(new Set(enlaces.flatMap((e) => [e.desde, e.hasta]))), enlaces };
  }

  // ---------------------------------------------------------------------------------------------------------------

  private async reunir(query: TrazabilidadQueryDto, tope: number): Promise<ItemTraza[]> {
    const correlaciones = await this.correlacionesDe(query);
    const quiere = (f: FuenteTraza) => !query.fuente || query.fuente === f;
    const [eventos, sagas, cambios] = await Promise.all([
      quiere('evento') ? this.eventos(query, correlaciones, tope) : [],
      quiere('saga') ? this.sagas(query, correlaciones, tope) : [],
      quiere('admin') ? this.cambios(query, correlaciones, tope) : [],
    ]);
    return [...eventos, ...sagas, ...cambios].sort((a, b) => b.en.localeCompare(a.en)).slice(0, tope);
  }

  /** A number (order or locator) brings the whole story of that purchase: every request that touched it. */
  private async correlacionesDe(query: TrazabilidadQueryDto): Promise<string[] | null> {
    if (!query.numero) return null;
    const rows = await this.dataSource.getRepository(AuditoriaTransaccion).createQueryBuilder('t').select('DISTINCT t.correlationId', 'c').where('t.numero = :n', { n: query.numero }).limit(50).getRawMany<{ c: string }>();
    return rows.map((r) => r.c);
  }

  private aplicarTiempo<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, campo: string, query: TrazabilidadQueryDto): void {
    if (query.desde) qb.andWhere(`${campo} >= :desde`, { desde: ecuadorDayRange(query.desde).start });
    if (query.hasta) qb.andWhere(`${campo} < :hasta`, { hasta: ecuadorDayRange(query.hasta).end });
    if (query.antes) qb.andWhere(`${campo} < :antes`, { antes: new Date(query.antes) });
  }

  private porCorrelacion<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, campo: string, query: TrazabilidadQueryDto, correlaciones: string[] | null): void {
    if (query.correlationId) qb.andWhere(`${campo} = :correlationId`, { correlationId: query.correlationId });
    if (correlaciones) qb.andWhere(correlaciones.length ? `${campo} IN (:...correlaciones)` : '1 = 0', { correlaciones });
  }

  private async eventos(query: TrazabilidadQueryDto, correlaciones: string[] | null, tope: number): Promise<ItemTraza[]> {
    if (query.tipo && esRuidoDeProveedor(query.tipo)) return [];
    const qb = this.dataSource.getRepository(AuditoriaTransaccion).createQueryBuilder('t').where(`t.tipo NOT LIKE 'proveedor.%' AND t.tipo NOT LIKE 'ReservaExterna%'`);
    this.porCorrelacion(qb, 't.correlationId', query, correlaciones);
    if (query.actor) qb.andWhere(new Brackets((w) => w.where('t.actorId = :actor', { actor: query.actor }).orWhere('t.propietarioId = :actor', { actor: query.actor })));
    if (query.tipo) qb.andWhere('t.tipo = :tipo', { tipo: query.tipo });
    if (query.entidad) qb.andWhere('t.entidad = :entidad', { entidad: query.entidad });
    if (query.id) qb.andWhere('t.agregadoId = :id', { id: query.id });
    this.aplicarTiempo(qb, 't.ocurridoEn', query);
    const rows = await qb.orderBy('t.ocurridoEn', 'DESC').take(tope).getMany();
    return rows.map((t) => ({
      fuente: 'evento' as const,
      id: t.id,
      en: t.ocurridoEn.toISOString(),
      correlationId: t.correlationId,
      tipo: t.tipo,
      estado: TIPOS_ERROR.has(t.tipo) || t.resumen.startsWith('estado=ERROR') ? ('ERROR' as const) : ('OK' as const),
      actorId: t.actorId ?? t.propietarioId,
      actorTipo: t.actorTipo,
      entidad: t.entidad,
      referencia: t.agregadoId,
      numero: t.numero,
      origen: t.origen ?? enlaceDeEvento(t.tipo)?.origen ?? null,
      destino: t.destino ?? enlaceDeEvento(t.tipo)?.destino ?? null,
      resumen: t.resumen,
    }));
  }

  private async sagas(query: TrazabilidadQueryDto, correlaciones: string[] | null, tope: number): Promise<ItemTraza[]> {
    if ((query.entidad && query.entidad !== 'oferta') || (query.tipo && esRuidoDeProveedor(query.tipo))) return [];
    const qb = this.dataSource.getRepository(AuditoriaSaga).createQueryBuilder('s').where(`s.tipo <> 'RESERVA_EXTERNA'`);
    this.porCorrelacion(qb, 's.correlationId', query, correlaciones);
    if (query.actor) qb.andWhere('s.propietarioId = :actor', { actor: query.actor });
    if (query.tipo) qb.andWhere('s.tipo = :tipo', { tipo: query.tipo });
    if (query.id) qb.andWhere('s.referencia = :id', { id: query.id });
    this.aplicarTiempo(qb, 's.iniciadaEn', query);
    const rows = await qb.orderBy('s.iniciadaEn', 'DESC').take(tope).getMany();
    if (rows.length === 0) return [];
    const pasos = await this.dataSource.getRepository(AuditoriaSagaPaso).createQueryBuilder('p').where('p.sagaId IN (:...ids)', { ids: rows.map((r) => r.sagaId) }).orderBy('p.secuencia', 'ASC').getMany();
    return rows.map((s) => ({
      fuente: 'saga' as const,
      id: s.sagaId,
      en: s.iniciadaEn.toISOString(),
      correlationId: s.correlationId,
      tipo: s.tipo,
      estado: s.estado === 'COMPLETADA' ? ('OK' as const) : s.estado === 'COMPENSADA' ? ('COMPENSADA' as const) : s.estado === 'FALLIDA' ? ('ERROR' as const) : ('EN_CURSO' as const),
      actorId: s.propietarioId,
      actorTipo: s.propietarioId.startsWith('guest:') ? 'GUEST' : 'CUSTOMER',
      entidad: 'oferta',
      referencia: s.referencia,
      numero: null,
      origen: 'ordenes',
      destino: 'ordenes',
      resumen: s.error ?? `saga ${s.estado}`,
      pasos: pasos.filter((p) => p.sagaId === s.sagaId).map((p) => ({ secuencia: p.secuencia, nombre: p.nombre, estado: p.estado, detalle: p.detalle, duracionMs: p.duracionMs, en: p.en.toISOString() })),
    }));
  }

  private async cambios(query: TrazabilidadQueryDto, correlaciones: string[] | null, tope: number): Promise<ItemTraza[]> {
    if (query.tipo && esRuidoDeProveedor(query.tipo.split('.')[0], query.tipo.split('.')[0])) return [];
    const qb = this.dataSource.getRepository(AuditoriaCambio).createQueryBuilder('a').where(`a.entidad <> 'proveedor'`);
    this.porCorrelacion(qb, 'a.correlationId', query, correlaciones);
    if (query.actor) qb.andWhere('a.actorId = :actor', { actor: query.actor });
    if (query.entidad) qb.andWhere('a.entidad = :entidad', { entidad: query.entidad });
    if (query.id) qb.andWhere('a.entidadId = :id', { id: query.id });
    if (query.tipo) qb.andWhere(`(a.entidad || '.' || a.accion) = :tipo`, { tipo: query.tipo });
    this.aplicarTiempo(qb, 'a.creadoEn', query);
    const rows = await qb.orderBy('a.creadoEn', 'DESC').take(tope).getMany();
    return rows.map((a) => ({
      fuente: 'admin' as const,
      id: a.id,
      en: a.creadoEn.toISOString(),
      correlationId: a.correlationId,
      tipo: `${a.entidad}.${a.accion}`,
      estado: 'OK' as const,
      actorId: a.actorId,
      actorTipo: 'ADMIN',
      entidad: a.entidad,
      referencia: a.entidadId,
      numero: null,
      origen: 'admin',
      destino: ENTIDADES_ADMIN[a.entidad] ?? 'api',
      // Before/after stay in the database: they can hold personal data (an e-mail when an account is created).
      resumen: `${a.entidad} ${a.entidadId} · ${a.accion}`,
    }));
  }
}
