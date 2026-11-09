import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import type { AuthClaims } from '../../auth/token.service';
import { documentHashOf } from '../../common/travellers';
import { formatMinorUnits, moneyAmount } from '../../common/money.util';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import { CancelBookingRequestDto } from '../../dto/postventa.dto';
import { Booking } from '../../entities/booking.entity';
import { BookingCambio } from '../../entities/booking-cambio.entity';
import { CheckIn } from '../../entities/check-in.entity';
import { FlightHold } from '../../entities/flight-hold.entity';
import { FlightHoldItem } from '../../entities/flight-hold-item.entity';
import { Passenger } from '../../entities/passenger.entity';
import { SeatAssignment } from '../../entities/seat-assignment.entity';
import { Ticket } from '../../entities/ticket.entity';
import { Traveller } from '../../entities/traveller.entity';
import { Vuelo } from '../../entities/vuelo.entity';
import { CancellationService } from '../../services/cancellation.service';
import { CheckInService } from '../../services/check-in.service';
import { AuditoriaCambio } from '../mercados/entities/auditoria-cambio.entity';
import { ReservasQueryDto } from './reservas-admin.dto';

const mask = (value: string): string => (value.length <= 3 ? '***' : `${'*'.repeat(value.length - 3)}${value.slice(-3)}`);
const iso = (d: Date | string): string => new Date(d).toISOString();
const amount = (minor: number | null | undefined): string | null => (minor === null || minor === undefined ? null : formatMinorUnits(minor));

/** The money of a booking for the reconciliation with its channel: base + taxes = total charged; refund + penalty = total once cancelled. */
function importesDe(b: Booking, taxesMinor: number | null | undefined) {
  const { baseFare = null, taxes = null } = moneyAmount(b.currency, b.totalMinor, taxesMinor);
  return {
    moneda: b.currency,
    base: baseFare,
    impuestos: taxes,
    total: formatMinorUnits(b.totalMinor),
    reembolso: amount(b.refundMinor),
    penalidad: amount(b.penaltyMinor),
  };
}

/** One CSV field: quoted when it holds a separator, a quote or a line break; a leading formula sign is neutralised. */
function csvField(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",;\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const CSV_EXPORT_MAX = 5_000;

/**
 * The counter of the airline: every GDS booking whatever its channel (the web or a partner such as Booking), found by
 * locator, partner order, payment reference or the passenger document, and acted on without being its owner (the
 * caller is an ADMIN, checked by the controller). Documents are searched through the blind index, never decrypted in SQL;
 * names are decrypted only to show them to the administrator, and the document is shown masked.
 */
@Injectable()
export class ReservasAdminService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly checkInService: CheckInService,
    private readonly cancellationService: CancellationService,
  ) {}

  async list(query: ReservasQueryDto) {
    const limite = query.limite ?? 20;
    const pagina = query.pagina ?? 1;
    const [rows, total] = await this.filtered(query)
      .orderBy('b.createdAt', 'DESC')
      .addOrderBy('b.bookingId', 'DESC')
      .skip((pagina - 1) * limite)
      .take(limite)
      .getManyAndCount();
    return { items: await this.views(this.dataSource.manager, rows), total, pagina, limite };
  }

  /**
   * The same search as the list, as CSV (one row per booking, the oldest first) for the reconciliation with a partner:
   * what it paid us, split into base and taxes, and what a cancellation refunded and kept. No passenger data.
   */
  async exportCsv(query: ReservasQueryDto): Promise<string> {
    const rows = await this.filtered(query).orderBy('b.createdAt', 'ASC').addOrderBy('b.bookingId', 'ASC').take(CSV_EXPORT_MAX).getMany();
    const views = await this.views(this.dataSource.manager, rows);
    const header = ['pnr', 'estado', 'canal', 'socio', 'partnerOrderId', 'paymentReference', 'proveedorPago', 'vuelos', 'salida', 'creadaEn', 'moneda', 'base', 'impuestos', 'total', 'reembolso', 'penalidad', 'pasajeros', 'bookingId'];
    const lines = views.map((v) =>
      [
        v.pnr,
        v.status,
        v.canal,
        v.socio?.partnerId,
        v.socio?.partnerOrderId,
        v.paymentReference,
        v.paymentProvider,
        v.vuelos.map((f) => `${f.codigoVuelo} ${f.origen}-${f.destino}`).join(' / '),
        v.vuelos[0]?.salida,
        v.creadaEn,
        v.importes.moneda,
        v.importes.base,
        v.importes.impuestos,
        v.importes.total,
        v.importes.reembolso,
        v.importes.penalidad,
        v.pasajeros.length,
        v.bookingId,
      ]
        .map(csvField)
        .join(','),
    );
    // BOM first so a spreadsheet reads the accents as UTF-8.
    return String.fromCharCode(0xfeff) + [header.join(','), ...lines].join('\r\n') + '\r\n';
  }

  private filtered(query: ReservasQueryDto) {
    const qb = this.dataSource.manager.createQueryBuilder(Booking, 'b');
    // `createdAt` is a timestamp without zone written by the database clock (UTC): the bounds go as UTC literals, never as
    // a JS Date (the driver would send it in the process's local time). A day bound covers the whole UTC day.
    if (query.desde) qb.andWhere('b.createdAt >= CAST(:desde AS timestamp)', { desde: query.desde.replace(/Z$/, '') });
    if (query.hasta) {
      if (query.hasta.length === 10) qb.andWhere('b.createdAt < CAST(:hasta AS date) + 1', { hasta: query.hasta });
      else qb.andWhere('b.createdAt <= CAST(:hasta AS timestamp)', { hasta: query.hasta.replace(/Z$/, '') });
    }
    if (query.estado) qb.andWhere('b.status = :estado', { estado: query.estado });
    if (query.pnr) qb.andWhere('b.pnr = :pnr', { pnr: query.pnr });
    if (query.partnerOrderId) qb.andWhere('b.channelPartnerOrderId = :po', { po: query.partnerOrderId });
    if (query.paymentReference) qb.andWhere('b.paymentReference = :pr', { pr: query.paymentReference });
    if (query.canal === 'SOCIO') qb.andWhere(`b.ownerId LIKE 'partner:%'`);
    if (query.canal === 'DIRECTO') qb.andWhere(`b.ownerId NOT LIKE 'partner:%'`);
    if (query.documento) {
      const hash = documentHashOf({ documentType: query.tipoDocumento ?? 'NATIONAL_ID', nationality: query.nacionalidad ?? 'EC', documentNumber: query.documento });
      // Through the ORM (not raw table names) so the configured schema applies.
      const sub = qb.subQuery().select('p.bookingId').from(Passenger, 'p').innerJoin(Traveller, 't', 't.travellerId = p.travellerId').where('t.documentHash = :hash').getQuery();
      qb.andWhere(`b.bookingId IN ${sub}`, { hash });
    }
    return qb;
  }

  async detail(bookingId: string) {
    const booking = await this.dataSource.manager.findOneBy(Booking, { bookingId });
    if (!booking) throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Reserva no encontrada', `No existe la reserva ${bookingId}.`);
    const [view] = await this.views(this.dataSource.manager, [booking]);
    const cambios = await this.dataSource.manager.find(BookingCambio, { where: { bookingId }, order: { cambiadoEn: 'ASC' } });
    return { ...view, cambios: cambios.map((c) => ({ en: iso(c.cambiadoEn), descripcion: c.descripcion })) };
  }

  /** Counter check-in: same window and rules as the traveller (409 outside them), for a booking of any owner. */
  async checkIn(auth: AuthClaims, bookingId: string) {
    const result = await this.checkInService.checkIn(auth, bookingId, { asAdmin: true });
    await this.auditar(auth, bookingId, 'CHECK_IN_MOSTRADOR', {}, { bookingId });
    return result;
  }

  async quote(auth: AuthClaims, bookingId: string) {
    return this.cancellationService.quote(auth.ownerId, bookingId, { asAdmin: true });
  }

  /** Counter cancellation: same penalty and refund as the traveller, announced to the owner subscribers (the feed of the partner). */
  async cancel(auth: AuthClaims, idempotencyKey: string, bookingId: string, body: CancelBookingRequestDto) {
    const result = await this.cancellationService.cancel(auth, idempotencyKey, bookingId, body, { asAdmin: true });
    await this.auditar(auth, bookingId, 'CANCELAR_MOSTRADOR', {}, { bookingId, reasonCode: body.reasonCode ?? 'CUSTOMER_REQUEST' });
    return result;
  }

  private auditar(auth: AuthClaims, bookingId: string, accion: string, antes: unknown, despues: unknown) {
    return this.dataSource.manager.save(this.dataSource.manager.create(AuditoriaCambio, { entidad: 'reserva', entidadId: bookingId, actorId: auth.ownerId, accion, antes, despues }));
  }

  private async views(manager: EntityManager, bookings: Booking[]) {
    if (bookings.length === 0) return [];
    const ids = bookings.map((b) => b.bookingId);
    const holdIds = bookings.map((b) => b.holdId);
    const [passengers, seats, checkIns, tickets, items, holds] = await Promise.all([
      manager.find(Passenger, { where: { bookingId: In(ids) } }),
      manager.find(SeatAssignment, { where: { bookingId: In(ids) } }),
      manager.find(CheckIn, { where: { bookingId: In(ids) } }),
      manager.find(Ticket, { where: { bookingId: In(ids) } }),
      manager.find(FlightHoldItem, { where: { holdId: In(holdIds) }, order: { orden: 'ASC' } }),
      manager.find(FlightHold, { where: { holdId: In(holdIds) }, select: { holdId: true, lockedTaxesMinor: true }, loadEagerRelations: false }),
    ]);
    const taxesOf = new Map(holds.map((h) => [h.holdId, h.lockedTaxesMinor]));
    const vuelos = new Map((await manager.find(Vuelo, { where: { id: In([...new Set(items.map((i) => i.vueloId))]) } })).map((v) => [v.id, v]));
    const by = <T extends { bookingId: string }>(rows: T[], id: string) => rows.filter((r) => r.bookingId === id);

    return bookings.map((b) => {
      const mine = by(passengers, b.bookingId);
      const partner = b.ownerId.startsWith('partner:');
      return {
        bookingId: b.bookingId,
        pnr: b.pnr,
        status: b.status,
        canal: partner ? 'SOCIO' : 'DIRECTO',
        socio: partner ? { partnerId: b.channelPartnerId ?? b.ownerId.split(':')[1], partnerOrderId: b.channelPartnerOrderId ?? null } : null,
        paymentReference: b.paymentReference,
        paymentProvider: b.paymentProvider ?? null,
        // `total` is what the channel paid us (taxes included); `importes` splits it and adds what a cancellation gave back.
        total: { currency: b.currency, total: formatMinorUnits(b.totalMinor) },
        importes: importesDe(b, taxesOf.get(b.holdId)),
        creadaEn: iso(b.createdAt),
        vuelos: items
          .filter((i) => i.holdId === b.holdId)
          .map((i) => vuelos.get(i.vueloId))
          .filter((v): v is Vuelo => !!v)
          .map((v) => ({ vueloId: v.id, codigoVuelo: v.codigoVuelo, origen: v.origenIATA, destino: v.destinoIATA, salida: iso(v.fechaSalida), estado: v.estado })),
        pasajeros: mine.map((p) => ({
          passengerId: p.passengerId,
          travellerId: p.travellerId,
          nombre: `${p.firstName} ${p.lastName}`,
          tipoDocumento: p.documentType,
          documento: mask(p.documentNumber),
          asientos: by(seats, b.bookingId)
            .filter((s) => s.passengerId === p.passengerId)
            .map((s) => ({ vueloId: s.vueloId, asiento: s.seatNumber })),
          checkIn: by(checkIns, b.bookingId).some((c) => c.passengerId === p.passengerId),
        })),
        billetes: by(tickets, b.bookingId).length,
      };
    });
  }
}
