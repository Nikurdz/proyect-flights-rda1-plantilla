import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { Vuelo } from '../entities/vuelo.entity';

@Injectable()
export class FlightStatusService {
  constructor(@InjectRepository(Vuelo) private readonly vuelos: Repository<Vuelo>) {}

  async getStatus(flightNumber: string, date: string) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const vuelo = await this.vuelos.findOne({ where: { codigoVuelo: flightNumber } });
    if (!vuelo) {
      throw new ProblemDetailsException(
        HttpStatus.NOT_FOUND,
        'FLIGHT_STATUS_NOT_AVAILABLE',
        'Flight not found',
        `No flight ${flightNumber} was found for ${date}.`,
      );
    }

    const departure = new Date(vuelo.fechaSalida);
    const arrival = new Date(vuelo.fechaLlegada);
    const now = new Date();

    let status: string;
    if (now < new Date(departure.getTime() - 30 * 60_000)) {
      status = 'SCHEDULED';
    } else if (now < departure) {
      status = 'BOARDING';
    } else if (now < arrival) {
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
        scheduledAt: departure.toISOString(),
        estimatedAt: null,
        actualAt: null,
      },
      arrival: {
        iataCode: vuelo.destinoIATA,
        terminal: null,
        scheduledAt: arrival.toISOString(),
        estimatedAt: null,
        actualAt: null,
      },
      aircraft: null,
      status,
    };
  }
}
