import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { toIso, todayUtc, utcDayRange } from '../common/date.util';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { Vuelo } from '../entities/vuelo.entity';

const BOARDING_WINDOW_MS = 30 * 60_000;

@Injectable()
export class FlightStatusService {
  constructor(@InjectRepository(Vuelo) private readonly vuelos: Repository<Vuelo>) {}

  /** Status of the flight that departs on `date` (a UTC calendar day), derived from its schedule. */
  async getStatus(flightNumber: string, requestedDate?: string) {
    const qb = this.vuelos.createQueryBuilder('v').where('v."codigoVuelo" = :flightNumber', { flightNumber });
    if (requestedDate) {
      const { start, end } = utcDayRange(requestedDate);
      qb.andWhere('v."fechaSalida" >= :start AND v."fechaSalida" < :end', { start, end });
    } else {
      // No date given: today's flight, or else the next one that operates.
      qb.andWhere('v."fechaSalida" >= :today', { today: utcDayRange(todayUtc()).start }).orderBy('v."fechaSalida"', 'ASC');
    }
    const vuelo = await qb.getOne();
    const date = requestedDate ?? (vuelo ? toIso(vuelo.fechaSalida).slice(0, 10) : todayUtc());

    if (!vuelo) {
      throw new ProblemDetailsException(
        HttpStatus.NOT_FOUND,
        'FLIGHT_STATUS_NOT_AVAILABLE',
        'Flight not found',
        `No flight ${flightNumber} operates on ${date}.`,
      );
    }

    const departure = new Date(vuelo.fechaSalida);
    const arrival = new Date(vuelo.fechaLlegada);
    const now = Date.now();

    let status: string;
    if (vuelo.estado === 'CANCELLED') {
      status = 'CANCELLED';
    } else if (now < departure.getTime() - BOARDING_WINDOW_MS) {
      status = 'SCHEDULED';
    } else if (now < departure.getTime()) {
      status = 'BOARDING';
    } else if (now < arrival.getTime()) {
      status = 'DEPARTED';
    } else {
      status = 'ARRIVED';
    }

    return {
      flightNumber: vuelo.codigoVuelo,
      date,
      marketingCarrier: vuelo.codigoAerolinea,
      operatingCarrier: vuelo.codigoAerolinea,
      departure: {
        iataCode: vuelo.origenIATA,
        terminal: null,
        scheduledAt: toIso(departure),
        estimatedAt: null,
        actualAt: null,
      },
      arrival: {
        iataCode: vuelo.destinoIATA,
        terminal: null,
        scheduledAt: toIso(arrival),
        estimatedAt: null,
        actualAt: null,
      },
      aircraft: null,
      status,
    };
  }
}
