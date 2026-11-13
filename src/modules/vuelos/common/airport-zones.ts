import { Injectable, OnModuleInit } from '@nestjs/common';
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
export class AirportZones implements OnModuleInit {
  private readonly cache = new Map<string, string>();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private preloading?: Promise<void>;

  /** The whole catalogue (a few dozen rows) in one query, at boot or on first use; a failure is retried on the next use. */
  preload(): Promise<void> {
    this.preloading ??= this.dataSource.manager
      .find(Localidad, { select: { iata: true, zonaHoraria: true } })
      .then((airports) => {
        for (const airport of airports) if (isKnownZone(airport.zonaHoraria)) this.cache.set(airport.iata, airport.zonaHoraria);
        if (airports.length === 0) this.preloading = undefined; // not seeded yet: look again on the next use
      })
      .catch(() => {
        this.preloading = undefined;
      });
    return this.preloading;
  }

  onModuleInit(): void {
    void this.preload();
  }

  async zoneOf(iata: string | undefined): Promise<string> {
    if (!iata) return DEFAULT_AIRPORT_ZONE;
    const cached = this.cache.get(iata);
    if (cached) return cached;
    await this.preload();
    const loaded = this.cache.get(iata);
    if (loaded) return loaded;

    // Not in the preloaded catalogue: it may have been created from the back office since.
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
