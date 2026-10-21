import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { toIso } from '../../common/date.util';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import { seatExists } from '../../common/seat-grid';
import { FlightHold } from '../../entities/flight-hold.entity';
import { SeatAssignment } from '../../entities/seat-assignment.entity';
import { Vuelo } from '../../entities/vuelo.entity';
import { Localidad } from '../catalogo/entities/localidad.entity';
import { AuditoriaCambio } from '../mercados/entities/auditoria-cambio.entity';
import { AdminActualizarVueloDto, AdminCrearVueloDto, AdminVueloViewDto } from './admin.dto';

const MINUTE_MS = 60_000;

const vista = (v: Vuelo, reservados: number): AdminVueloViewDto => ({
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
  asientosReservados: reservados,
  estado: v.estado,
});

/**
 * Back-office management of the flight schedule: create, edit and delete a flight. Cancelling and rescheduling (which
 * must tell the bookings and the subscribers) stay in `AdminService`. Every change is recorded in the audit trail.
 * Nothing here touches `asientosDisponibles` except to keep it consistent with a new capacity: the inventory rules
 * (conditional UPDATE by `InventoryService`) are the same as for any sale.
 */
@Injectable()
export class VuelosAdminService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async crear(actorId: string, dto: AdminCrearVueloDto): Promise<AdminVueloViewDto> {
    const salida = new Date(dto.salida);
    if (salida.getTime() <= Date.now()) {
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid departure', 'The departure must be in the future.', [{ name: 'salida', reason: 'must be in the future' }]);
    }
    if (dto.origen === dto.destino) {
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Same origin and destination', 'Origin and destination must differ.', [{ name: 'destino', reason: 'must differ from origen' }]);
    }

    return this.dataSource.transaction(async (manager) => {
      const known = await manager.getRepository(Localidad).countBy([{ iata: dto.origen }, { iata: dto.destino }]);
      if (known !== 2) {
        throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', 'Unknown airport', 'Origin and destination must be airports of the catalogue (GET /localidades).', [
          { name: 'origen/destino', reason: 'not in the catalogue' },
        ]);
      }
      const capacidad = dto.capacidad ?? 180;
      let vuelo: Vuelo;
      try {
        vuelo = await manager.save(
          manager.create(Vuelo, {
            aerolinea: dto.aerolinea.trim(),
            codigoAerolinea: dto.codigoVuelo.slice(0, 2),
            codigoVuelo: dto.codigoVuelo,
            origenIATA: dto.origen,
            destinoIATA: dto.destino,
            fechaSalida: salida,
            fechaLlegada: new Date(salida.getTime() + dto.duracionMinutos * MINUTE_MS),
            precioBase: dto.precioBaseUsd,
            asientosDisponibles: capacidad,
            capacidadTotal: capacidad,
            durationMinutes: dto.duracionMinutos,
            estado: 'SCHEDULED',
          }),
        );
      } catch (error) {
        if ((error as { code?: string; driverError?: { code?: string } }).driverError?.code === '23505') {
          throw new ProblemDetailsException(HttpStatus.CONFLICT, 'CONFLICT', 'Flight already exists', `Flight ${dto.codigoVuelo} already departs at that time.`);
        }
        throw error;
      }
      await this.auditar(manager, actorId, vuelo.id, 'CREAR', {}, { codigoVuelo: vuelo.codigoVuelo, origen: vuelo.origenIATA, destino: vuelo.destinoIATA, salida: toIso(vuelo.fechaSalida), capacidad });
      return vista(vuelo, 0);
    });
  }

  async actualizar(actorId: string, vueloId: string, dto: AdminActualizarVueloDto): Promise<AdminVueloViewDto> {
    return this.dataSource.transaction(async (manager) => {
      const vuelo = await this.bloquear(manager, vueloId);
      if (vuelo.estado === 'CANCELLED' || new Date(vuelo.fechaSalida).getTime() <= Date.now()) {
        throw new ProblemDetailsException(HttpStatus.CONFLICT, 'CONFLICT', 'Flight cannot be edited', 'Only scheduled flights that have not departed can be edited.');
      }
      const antes = { aerolinea: vuelo.aerolinea, precioBaseUsd: vuelo.precioBase, duracionMinutos: vuelo.durationMinutes, capacidadTotal: vuelo.capacidadTotal };

      const vendidos = vuelo.capacidadTotal - vuelo.asientosDisponibles; // sold or held: what the new capacity must still fit
      const asignados = await manager.getRepository(SeatAssignment).find({ where: { vueloId } });
      if (dto.capacidadTotal !== undefined && dto.capacidadTotal !== vuelo.capacidadTotal) {
        if (dto.capacidadTotal < vendidos) {
          throw new ProblemDetailsException(HttpStatus.CONFLICT, 'CONFLICT', 'Capacity below the seats sold', `${vendidos} seat(s) are already sold or held; the capacity cannot be lower.`);
        }
        const fuera = asignados.filter((a) => !seatExists(dto.capacidadTotal as number, a.seatNumber));
        if (fuera.length > 0) {
          throw new ProblemDetailsException(HttpStatus.CONFLICT, 'CONFLICT', 'Assigned seats outside the cabin', `Seat(s) ${fuera.map((f) => f.seatNumber).join(', ')} are assigned and would no longer exist.`);
        }
        vuelo.capacidadTotal = dto.capacidadTotal;
        vuelo.asientosDisponibles = dto.capacidadTotal - vendidos;
      }
      if (dto.aerolinea !== undefined) vuelo.aerolinea = dto.aerolinea.trim();
      if (dto.precioBaseUsd !== undefined) vuelo.precioBase = dto.precioBaseUsd;
      if (dto.duracionMinutos !== undefined) {
        vuelo.durationMinutes = dto.duracionMinutos;
        vuelo.fechaLlegada = new Date(new Date(vuelo.fechaSalida).getTime() + dto.duracionMinutos * MINUTE_MS);
      }

      await manager.save(vuelo);
      await this.auditar(manager, actorId, vuelo.id, 'ACTUALIZAR', antes, { aerolinea: vuelo.aerolinea, precioBaseUsd: vuelo.precioBase, duracionMinutos: vuelo.durationMinutes, capacidadTotal: vuelo.capacidadTotal });
      return vista(vuelo, asignados.length);
    });
  }

  /**
   * Hard delete, only for a flight that never had a hold, a booking or an assigned seat. Anything with history is
   * refused (409 FLIGHT_IN_USE): cancel it instead, which closes it to sales and refunds its bookings.
   */
  async eliminar(actorId: string, vueloId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const vuelo = await this.bloquear(manager, vueloId);
      const asientos = await manager.getRepository(SeatAssignment).count({ where: { vueloId } });
      const holds = await manager
        .getRepository(FlightHold)
        .createQueryBuilder('h')
        .where('h."inventory" @> :inventory::jsonb', { inventory: JSON.stringify([{ vueloId }]) })
        .getCount();
      if (asientos > 0 || holds > 0) {
        throw new ProblemDetailsException(HttpStatus.CONFLICT, 'FLIGHT_IN_USE', 'Flight has reservations', 'This flight has holds, bookings or assigned seats. Cancel it instead (POST /admin/vuelos/{vueloId}/cancelar).');
      }
      await manager.delete(Vuelo, { id: vueloId });
      await this.auditar(manager, actorId, vueloId, 'ELIMINAR', { codigoVuelo: vuelo.codigoVuelo, origen: vuelo.origenIATA, destino: vuelo.destinoIATA, salida: toIso(vuelo.fechaSalida) }, {});
    });
  }

  private async bloquear(manager: EntityManager, vueloId: string): Promise<Vuelo> {
    const vuelo = await manager.findOne(Vuelo, { where: { id: vueloId }, lock: { mode: 'pessimistic_write' } });
    if (!vuelo) throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Flight not found', `No flight ${vueloId}.`);
    return vuelo;
  }

  private auditar(manager: EntityManager, actorId: string, entidadId: string, accion: string, antes: unknown, despues: unknown) {
    return manager.save(manager.create(AuditoriaCambio, { entidad: 'vuelo', entidadId, actorId, accion, antes, despues }));
  }
}
