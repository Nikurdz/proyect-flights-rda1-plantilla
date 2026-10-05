import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { toIso, utcDayRange } from '../common/date.util';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { Vuelo } from '../entities/vuelo.entity';

const BOARDING_WINDOW_MS = 30 * 60_000;

@Injectable()
export class FlightStatusService {
  constructor(@InjectRepository(Vuelo) private readonly vuelos: Repository<Vuelo>) {}

  /** Status of the flight that departs on `date` (a UTC calendar day), derived from its schedule. */
  async getStatus(flightNumber: string, date: string) {
    const { start, end } = utcDayRange(date);
    const vuelo = await this.vuelos
      .createQueryBuilder('v')
      .where('v."codigoVuelo" = :flightNumber', { flightNumber })
      .andWhere('v."fechaSalida" >= :start AND v."fechaSalida" < :end', { start, end })
      .getOne();

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
    if (now < departure.getTime() - BOARDING_WINDOW_MS) {
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
