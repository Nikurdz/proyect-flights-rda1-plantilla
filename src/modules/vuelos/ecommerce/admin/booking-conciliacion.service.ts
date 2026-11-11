import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { ecuadorDayRange } from '../../common/date.util';
import { formatMinorUnits } from '../../common/money.util';
import { VUELOS_CONFIG, VuelosConfig } from '../../common/vuelos-config';
import { BaggagePurchase } from '../../entities/baggage-purchase.entity';
import { Booking } from '../../entities/booking.entity';
import { DateChangeOffer } from '../../entities/date-change-offer.entity';
import { FlightHold } from '../../entities/flight-hold.entity';
import { FlightHoldItem } from '../../entities/flight-hold-item.entity';
import { ConciliacionQueryDto } from './booking-conciliacion.dto';
import { csvField } from './reservas-admin.service';

const CAP = 5_000; // rows read for a summary, an alert filter or a CSV
const amount = (minor: number): string => formatMinorUnits(minor);
const naive = (d: Date): string => d.toISOString().slice(0, 19).replace('T', ' '); // `createdAt` is a timestamp without zone (UTC clock)

interface Linea {
  bookingId: string;
  pnr: string;
  fecha: string;
  partnerOrderId: string | null;
  paymentReference: string;
  estado: string;
  moneda: string;
  /** Minor units, for the aggregation. */
  minor: { base: number | null; iva: number | null; total: number; reembolso: number; penalidad: number; equipaje: number; cambiosTarifa: number; cambiosCargo: number };
  base: string | null;
  iva: string | null;
  ivaEsperado: string | null;
  ivaSegunBooking: string;
  diferenciaConBooking: string | null;
  ivaAlerta: boolean;
  total: string;
  notaCredito: { numero: string; reembolso: string; penalidad: string } | null;
  equipaje: string;
  cambiosFecha: { diferencias: string; cargo: string };
}

/**
 * Reconciliation of the sales of a partner (Booking) with the invoices it issues. We issue no invoice for them (Booking
 * is the biller, assuming 15 % VAT *included*), so this is a read-only view built from the bookings: each sale as an
 * invoice line, the credit note derived from a cancellation, our VAT next to what Booking would compute, an alert when
 * the VAT does not add up, and the extra charges (baggage, date changes). It is not a fiscal document.
 */
@Injectable()
export class BookingConciliacionService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
  ) {}

  async resumen(query: ConciliacionQueryDto) {
    const rows = await this.filtered(query).orderBy('b.createdAt', 'ASC').take(CAP).getMany();
    const lines = await this.lineas(this.dataSource.manager, rows);
    const days = new Map<string, Totales>();
    const total = nuevoTotal();
    for (const line of lines) {
      for (const bucket of [days.get(line.fecha) ?? days.set(line.fecha, nuevoTotal()).get(line.fecha)!, total]) acumular(bucket, line);
    }
    return {
      periodo: { desde: query.desde ?? null, hasta: query.hasta ?? null, zonaHoraria: 'America/Guayaquil' },
      moneda: lines[0]?.moneda ?? 'USD',
      total: formato(total),
      dias: [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([fecha, t]) => ({ fecha, ...formato(t) })),
      truncado: rows.length >= CAP,
    };
  }

  async listar(query: ConciliacionQueryDto) {
    const limite = query.limite ?? 25;
    const pagina = query.pagina ?? 1;
    if (query.soloAlertas) {
      const rows = await this.filtered(query).orderBy('b.createdAt', 'DESC').take(CAP).getMany();
      const alerts = (await this.lineas(this.dataSource.manager, rows)).filter((l) => l.ivaAlerta);
      return { items: alerts.slice((pagina - 1) * limite, pagina * limite).map(publica), total: alerts.length, pagina, limite };
    }
    const [rows, total] = await this.filtered(query)
      .orderBy('b.createdAt', 'DESC')
      .addOrderBy('b.bookingId', 'DESC')
      .skip((pagina - 1) * limite)
      .take(limite)
      .getManyAndCount();
    return { items: (await this.lineas(this.dataSource.manager, rows)).map(publica), total, pagina, limite };
  }

  async exportCsv(query: ConciliacionQueryDto): Promise<string> {
    const rows = await this.filtered(query).orderBy('b.createdAt', 'ASC').take(CAP).getMany();
    const lines = (await this.lineas(this.dataSource.manager, rows)).filter((l) => !query.soloAlertas || l.ivaAlerta);
    const header = ['fecha', 'pnr', 'partnerOrderId', 'paymentReference', 'estado', 'moneda', 'base', 'iva', 'ivaEsperado', 'ivaSegunBooking', 'alertaIva', 'total', 'notaCredito', 'reembolso', 'penalidad', 'equipaje', 'cambiosFechaDiferencias', 'cambiosFechaCargo', 'bookingId'];
    const body = lines.map((l) =>
      [l.fecha, l.pnr, l.partnerOrderId, l.paymentReference, l.estado, l.moneda, l.base, l.iva, l.ivaEsperado, l.ivaSegunBooking, l.ivaAlerta ? 'SI' : 'NO', l.total, l.notaCredito?.numero, l.notaCredito?.reembolso, l.notaCredito?.penalidad, l.equipaje, l.cambiosFecha.diferencias, l.cambiosFecha.cargo, l.bookingId]
        .map(csvField)
        .join(','),
    );
    return String.fromCharCode(0xfeff) + [header.join(','), ...body].join('\r\n') + '\r\n';
  }

  /** Sales of a partner; the days are Ecuador days and go to the database as UTC literals of a `timestamp` column. */
  private filtered(query: ConciliacionQueryDto) {
    const qb = this.dataSource.manager.createQueryBuilder(Booking, 'b').where(`b.ownerId LIKE 'partner:%'`);
    if (query.desde) qb.andWhere('b.createdAt >= CAST(:desde AS timestamp)', { desde: naive(ecuadorDayRange(query.desde).start) });
    if (query.hasta) qb.andWhere('b.createdAt < CAST(:hasta AS timestamp)', { hasta: naive(ecuadorDayRange(query.hasta).end) });
    if (query.partnerId) qb.andWhere('(b.channelPartnerId = :pid OR b.ownerId = :own OR b.ownerId LIKE :ownUser)', { pid: query.partnerId, own: `partner:${query.partnerId}`, ownUser: `partner:${query.partnerId}:%` });
    if (query.estado) qb.andWhere('b.status = :estado', { estado: query.estado });
    return qb;
  }

  private async lineas(manager: EntityManager, bookings: Booking[]): Promise<Linea[]> {
    if (bookings.length === 0) return [];
    const ids = bookings.map((b) => b.bookingId);
    const holdIds = bookings.map((b) => b.holdId);
    const [holds, items, baggage, changes, days] = await Promise.all([
      manager.find(FlightHold, { where: { holdId: In(holdIds) }, loadEagerRelations: false }),
      manager.find(FlightHoldItem, { where: { holdId: In(holdIds) } }),
      manager.find(BaggagePurchase, { where: { bookingId: In(ids) } }),
      manager.find(DateChangeOffer, { where: { bookingId: In(ids), status: 'USED' } }),
      manager
        .createQueryBuilder(Booking, 'b')
        .select('b.bookingId', 'id')
        .addSelect(`to_char((b."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD')`, 'dia')
        .where('b.bookingId IN (:...ids)', { ids })
        .getRawMany<{ id: string; dia: string }>(),
    ]);
    const dayOf = new Map(days.map((d) => [d.id, d.dia]));
    const rate = this.config.taxRate;

    return bookings.map((b) => {
      const hold = holds.find((h) => h.holdId === b.holdId);
      const taxes = hold?.lockedTaxesMinor ?? null;
      const base = taxes === null || taxes > b.totalMinor ? null : b.totalMinor - taxes;
      const pax = hold ? hold.adults + hold.youths + hold.children + hold.infants : 1;
      const legs = items.filter((i) => i.holdId === b.holdId).length || 1;
      const esperado = base === null ? null : Math.round(base * rate);
      const segunBooking = b.totalMinor - Math.round(b.totalMinor / (1 + rate)); // 15 % included in the total
      // Rounding is per unit price and passenger type: allow a cent per passenger and leg.
      const alerta = taxes !== null && esperado !== null && Math.abs(taxes - esperado) > Math.max(1, pax * legs);
      const bag = baggage.filter((x) => x.bookingId === b.bookingId).reduce((s, x) => s + x.totalMinor, 0);
      const mine = changes.filter((x) => x.bookingId === b.bookingId);
      const cambiosTarifa = mine.reduce((s, x) => s + x.fareDifferenceMinor + x.taxDifferenceMinor, 0);
      const cambiosCargo = mine.reduce((s, x) => s + x.changeFeeMinor, 0);
      const cancelada = b.status === 'CANCELLED';
      const reembolso = cancelada ? (b.refundMinor ?? 0) : 0;
      const penalidad = cancelada ? (b.penaltyMinor ?? 0) : 0;
      return {
        bookingId: b.bookingId,
        pnr: b.pnr,
        fecha: dayOf.get(b.bookingId) ?? '',
        partnerOrderId: b.channelPartnerOrderId ?? null,
        paymentReference: b.paymentReference,
        estado: b.status,
        moneda: b.currency,
        minor: { base, iva: taxes, total: b.totalMinor, reembolso, penalidad, equipaje: bag, cambiosTarifa, cambiosCargo },
        base: base === null ? null : amount(base),
        iva: taxes === null ? null : amount(taxes),
        ivaEsperado: esperado === null ? null : amount(esperado),
        ivaSegunBooking: amount(segunBooking),
        diferenciaConBooking: taxes === null ? null : amount(taxes - segunBooking),
        ivaAlerta: alerta,
        total: amount(b.totalMinor),
        notaCredito: cancelada ? { numero: `NC-${b.pnr}`, reembolso: amount(reembolso), penalidad: amount(penalidad) } : null,
        equipaje: amount(bag),
        cambiosFecha: { diferencias: amount(cambiosTarifa), cargo: amount(cambiosCargo) },
      };
    });
  }
}

interface Totales {
  ventas: number;
  base: number;
  iva: number;
  total: number;
  cancelaciones: number;
  reembolsos: number;
  penalidades: number;
  equipaje: number;
  cambiosFecha: number;
  alertasIva: number;
}
const nuevoTotal = (): Totales => ({ ventas: 0, base: 0, iva: 0, total: 0, cancelaciones: 0, reembolsos: 0, penalidades: 0, equipaje: 0, cambiosFecha: 0, alertasIva: 0 });

function acumular(t: Totales, l: Linea): void {
  t.ventas += 1;
  t.base += l.minor.base ?? 0;
  t.iva += l.minor.iva ?? 0;
  t.total += l.minor.total;
  if (l.notaCredito) t.cancelaciones += 1;
  t.reembolsos += l.minor.reembolso;
  t.penalidades += l.minor.penalidad;
  t.equipaje += l.minor.equipaje;
  t.cambiosFecha += l.minor.cambiosTarifa + l.minor.cambiosCargo;
  if (l.ivaAlerta) t.alertasIva += 1;
}

/** Net = what the partner paid, plus the extra charges, minus what was refunded. */
function formato(t: Totales) {
  return {
    ventas: t.ventas,
    base: amount(t.base),
    iva: amount(t.iva),
    total: amount(t.total),
    cancelaciones: t.cancelaciones,
    reembolsos: amount(t.reembolsos),
    penalidades: amount(t.penalidades),
    equipaje: amount(t.equipaje),
    cambiosFecha: amount(t.cambiosFecha),
    neto: amount(t.total + t.equipaje + t.cambiosFecha - t.reembolsos),
    alertasIva: t.alertasIva,
  };
}

/** The line without the minor-unit helper. */
function publica({ minor: _minor, ...line }: Linea) {
  return line;
}
