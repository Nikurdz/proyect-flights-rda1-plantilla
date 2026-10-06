import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { decodeCursor, encodeCursor } from '../../common/cursor.util';
import { toIso, utcDayRange } from '../../common/date.util';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import { buildSeatGrid } from '../../common/seat-grid';
import { Booking } from '../../entities/booking.entity';
import { SeatAssignment } from '../../entities/seat-assignment.entity';
import { Vuelo } from '../../entities/vuelo.entity';
import { Orden } from '../ordenes/entities/orden.entity';
import { OrdenesService } from '../ordenes/ordenes.service';
import { AdminAsientosVueloDto, AdminOrdenViewDto, AdminOrdenesPaginaDto, AdminOrdenesQueryDto, AdminVuelosPaginaDto, AdminVuelosQueryDto } from './admin.dto';

/**
 * Back-office read access. The customer-facing APIs are strictly owner-only; this is the single
 * place that reads across owners, and it sits behind the ADMIN role (see the controller).
 */
@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Orden) private readonly ordenes: Repository<Orden>,
    @InjectRepository(Vuelo) private readonly vuelos: Repository<Vuelo>,
    @InjectRepository(SeatAssignment) private readonly asientos: Repository<SeatAssignment>,
    @InjectRepository(Booking) private readonly reservas: Repository<Booking>,
    private readonly ordenesService: OrdenesService,
  ) {}

  async listarOrdenes(query: AdminOrdenesQueryDto): Promise<AdminOrdenesPaginaDto> {
    const limit = query.limit ?? 25;
    const qb = this.ordenes.createQueryBuilder('o');
    if (query.estado) qb.andWhere('o."estado" = :estado', { estado: query.estado });
    if (query.numero) qb.andWhere('o."numeroOrden" = :numero', { numero: query.numero });
    if (query.pnr) qb.andWhere('o."pnr" = :pnr', { pnr: query.pnr });
    if (query.desde) qb.andWhere('o."creadaEn" >= :desde', { desde: utcDayRange(query.desde).start });
    if (query.hasta) qb.andWhere('o."creadaEn" < :hasta', { hasta: utcDayRange(query.hasta).end });
    if (query.cursor) {
      const { createdAt, id } = decodeCursor(query.cursor);
      qb.andWhere('(o."creadaEn", o."ordenId") < (:cursorAt, :cursorId)', { cursorAt: createdAt, cursorId: id });
    }

    const rows = await qb.orderBy('o."creadaEn"', 'DESC').addOrderBy('o."ordenId"', 'DESC').take(limit + 1).getMany();
    const page = rows.slice(0, limit);
    return {
      items: page.map((orden) => this.vistaAdmin(orden)),
      ...(rows.length > limit ? { nextCursor: encodeCursor(page[page.length - 1].creadaEn, page[page.length - 1].ordenId) } : {}),
    };
  }

  async obtenerOrden(numeroOrden: string): Promise<AdminOrdenViewDto> {
    const orden = await this.ordenes.findOne({ where: { numeroOrden } });
    if (!orden) throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found', `No order ${numeroOrden}.`);
    return this.vistaAdmin(orden);
  }

  async listarVuelos(query: AdminVuelosQueryDto): Promise<AdminVuelosPaginaDto> {
    const limit = query.limit ?? 25;
    const qb = this.vuelos.createQueryBuilder('v');
    if (query.origen) qb.andWhere('v."origenIATA" = :origen', { origen: query.origen });
    if (query.destino) qb.andWhere('v."destinoIATA" = :destino', { destino: query.destino });
    if (query.vuelo) qb.andWhere('v."codigoVuelo" = :vuelo', { vuelo: query.vuelo });
    if (query.fecha) {
      const { start, end } = utcDayRange(query.fecha);
      qb.andWhere('v."fechaSalida" >= :start AND v."fechaSalida" < :end', { start, end });
    } else {
      qb.andWhere('v."fechaSalida" >= :now', { now: new Date() });
    }
    if (query.cursor) {
      const { createdAt, id } = decodeCursor(query.cursor);
      qb.andWhere('(v."fechaSalida", v."id") > (:cursorAt, :cursorId)', { cursorAt: createdAt, cursorId: id });
    }

    const rows = await qb.orderBy('v."fechaSalida"', 'ASC').addOrderBy('v."id"', 'ASC').take(limit + 1).getMany();
    const page = rows.slice(0, limit);
    const reservados = await this.contarAsientosReservados(page.map((v) => v.id));
    return {
      items: page.map((v) => ({
        vueloId: v.id,
        codigoVuelo: v.codigoVuelo,
        aerolinea: v.aerolinea,
        origen: v.origenIATA,
        destino: v.destinoIATA,
        salida: toIso(v.fechaSalida),
        llegada: toIso(v.fechaLlegada),
        duracionMinutos: v.durationMinutes,
        precioBaseUsd: v.precioBase,
        asientosDisponibles: v.asientosDisponibles,
        capacidadTotal: v.capacidadTotal,
        asientosReservados: reservados.get(v.id) ?? 0,
      })),
      ...(rows.length > limit ? { nextCursor: encodeCursor(page[page.length - 1].fechaSalida, page[page.length - 1].id) } : {}),
    };
  }

  /** How many numbered seats are taken on each of these flights (one grouped query for the whole page). */
  private async contarAsientosReservados(vueloIds: string[]): Promise<Map<string, number>> {
    if (vueloIds.length === 0) return new Map();
    const rows = await this.asientos
      .createQueryBuilder('s')
      .select('s."vueloId"', 'vueloId')
      .addSelect('COUNT(*)::int', 'n')
      .where('s."vueloId" IN (:...ids)', { ids: vueloIds })
      .groupBy('s."vueloId"')
      .getRawMany<{ vueloId: string; n: number }>();
    return new Map(rows.map((r) => [r.vueloId, Number(r.n)]));
  }

  /**
   * The cabin of one flight with every seat already reserved and the booking that holds it. It shows the
   * locator and the order number only: passenger names are encrypted personal data and are not needed here.
   */
  async asientosDeVuelo(vueloId: string): Promise<AdminAsientosVueloDto> {
    const vuelo = await this.vuelos.findOne({ where: { id: vueloId } });
    if (!vuelo) throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Flight not found', `No flight ${vueloId}.`);

    const asignados = await this.asientos.find({ where: { vueloId } });
    const bookingIds = [...new Set(asignados.map((s) => s.bookingId))];
    const reservas = bookingIds.length ? await this.reservas.find({ where: { bookingId: In(bookingIds) }, select: { bookingId: true, pnr: true } }) : [];
    const ordenes = bookingIds.length ? await this.ordenes.find({ where: { bookingId: In(bookingIds) }, select: { bookingId: true, numeroOrden: true } }) : [];
    const pnrDe = new Map(reservas.map((b) => [b.bookingId, b.pnr]));
    const ordenDe = new Map(ordenes.map((o) => [o.bookingId as string, o.numeroOrden]));

    const ocupados = new Set(asignados.map((s) => s.seatNumber));
    const orden = (seat: string) => [Number.parseInt(seat, 10), seat.slice(-1)] as const;
    return {
      vueloId: vuelo.id,
      codigoVuelo: vuelo.codigoVuelo,
      origen: vuelo.origenIATA,
      destino: vuelo.destinoIATA,
      salida: toIso(vuelo.fechaSalida),
      capacidadTotal: vuelo.capacidadTotal,
      reservados: asignados
        .map((s) => ({ asiento: s.seatNumber, pnr: pnrDe.get(s.bookingId) ?? '', numeroOrden: ordenDe.get(s.bookingId) ?? null }))
        .sort((x, y) => {
          const [rx, cx] = orden(x.asiento);
          const [ry, cy] = orden(y.asiento);
          return rx - ry || cx.localeCompare(cy);
        }),
      filas: buildSeatGrid(vuelo.capacidadTotal).map((fila) => ({
        rowNumber: fila.rowNumber,
        seats: fila.seats.map((seat) => ({ seatNumber: seat.seatNumber, isAvailable: !ocupados.has(seat.seatNumber), characteristics: seat.characteristics })),
      })),
    };
  }

  private vistaAdmin(orden: Orden): AdminOrdenViewDto {
    return {
      ...this.ordenesService.vista(orden),
      clienteId: orden.clienteId,
      comprador: orden.clienteId ? 'cliente' : 'invitado',
      canal: orden.canal,
    };
  }
}
