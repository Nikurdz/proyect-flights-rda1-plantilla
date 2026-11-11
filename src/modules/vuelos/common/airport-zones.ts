import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Localidad } from '../ecommerce/catalogo/entities/localidad.entity';

/** The zone assumed for an airport the catalogue does not know (and for a search with no origin). */
export const DEFAULT_AIRPORT_ZONE = 'America/Guayaquil';

/**
 * IANA time zone of an airport, read from the catalogue (`ecom_localidades.zonaHoraria`) and kept in memory: an airport
 * is never edited or deleted, so a zone that was read stays valid. An unknown code is not cached (the airport may be
 * created later from the back office).
 */
@Injectable()
export class AirportZones {
  private readonly cache = new Map<string, string>();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async zoneOf(iata: string | undefined): Promise<string> {
    if (!iata) return DEFAULT_AIRPORT_ZONE;
    const cached = this.cache.get(iata);
    if (cached) return cached;

    const airport = await this.dataSource.manager.findOne(Localidad, { where: { iata }, select: { iata: true, zonaHoraria: true } });
    if (!airport || !isKnownZone(airport.zonaHoraria)) return DEFAULT_AIRPORT_ZONE;
    this.cache.set(iata, airport.zonaHoraria);
    return airport.zonaHoraria;
  }
}

function isKnownZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}
