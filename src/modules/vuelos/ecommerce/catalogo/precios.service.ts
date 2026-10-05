import { Inject, Injectable } from '@nestjs/common';
import { toMinorUnits } from '../../common/money.util';
import { PASSENGER_TYPES, PassengerBreakdown, PassengerType, countFor, priceForPassengerType } from '../../common/pricing.util';
import { VUELOS_CONFIG, VuelosConfig } from '../../common/vuelos-config';
import { FareFamily } from '../../entities/fare-family.entity';
import { Vuelo } from '../../entities/vuelo.entity';
import { convertFromUsd } from '../common/moneda.util';
import { Mercado } from '../mercados/entities/mercado.entity';

export interface PrecioUnitario {
  baseMinor: number;
  tasasMinor: number;
  /** RN-07: always base + taxes and charges. */
  totalMinor: number;
}

export interface Cotizacion {
  moneda: string;
  unitarios: Partial<Record<PassengerType, PrecioUnitario>>;
  /** Whole party, one flight, one fare family. */
  totalMinor: number;
}

/**
 * D05 pricing in the market currency. The inventory is priced in USD with the same rules the
 * flight core uses (priceForPassengerType), then each component is converted at the market's
 * rate, so the amount shown is the amount charged and the parts always add up (RN-07).
 */
@Injectable()
export class PreciosService {
  constructor(@Inject(VUELOS_CONFIG) private readonly config: VuelosConfig) {}

  cotizar(vuelo: Vuelo, familia: FareFamily, composicion: PassengerBreakdown, mercado: Mercado): Cotizacion {
    const usdBase = toMinorUnits(vuelo.precioBase);
    const unitarios: Partial<Record<PassengerType, PrecioUnitario>> = {};
    let totalMinor = 0;

    for (const tipo of PASSENGER_TYPES) {
      const cantidad = countFor(composicion, tipo);
      if (cantidad === 0) continue;

      const usd = priceForPassengerType(usdBase, familia.priceMultiplier, tipo, this.config.taxRate);
      const baseMinor = convertFromUsd(usd.baseFare, mercado.tipoCambioDesdeUsd, mercado.moneda);
      const tasasMinor = convertFromUsd(usd.taxes, mercado.tipoCambioDesdeUsd, mercado.moneda);
      unitarios[tipo] = { baseMinor, tasasMinor, totalMinor: baseMinor + tasasMinor };
      totalMinor += (baseMinor + tasasMinor) * cantidad;
    }
    return { moneda: mercado.moneda, unitarios, totalMinor };
  }

  /** RF-PRC-010: the lowest per-adult price among the flight's fare families. */
  precioDesde(vuelo: Vuelo, familias: FareFamily[], mercado: Mercado): { familia: FareFamily; totalMinor: number } {
    const uno: PassengerBreakdown = { adults: 1, youths: 0, children: 0, infants: 0 };
    return familias
      .map((familia) => ({ familia, totalMinor: this.cotizar(vuelo, familia, uno, mercado).unitarios.ADULT!.totalMinor }))
      .reduce((best, current) => (current.totalMinor < best.totalMinor ? current : best));
  }
}
