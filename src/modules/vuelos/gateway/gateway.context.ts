import DataLoader = require('dataloader');
import { In, Repository } from 'typeorm';
import type { AuthClaims } from '../auth/token.service';
import { Factura } from '../ecommerce/facturacion/entities/factura.entity';
import { facturaGql } from './gateway.service';
import type { FacturaGql } from './gateway.types';

export interface Loaders {
  facturaDeOrden: DataLoader<string, FacturaGql | null>;
  facturaDeReserva: DataLoader<string, FacturaGql | null>;
}

/** What every resolver receives: who is asking (null if nobody) and the loaders of this request. */
export interface GatewayContext {
  auth: AuthClaims | null;
  loaders: Loaders;
}

/** Fresh loaders per request, so a cache never crosses from one user to another. */
export function crearLoaders(facturas: Repository<Factura>): Loaders {
  const porClave = (campo: 'ordenId' | 'reservaExternaId') =>
    new DataLoader<string, FacturaGql | null>(async (claves) => {
      const filas = await facturas.find({ where: { [campo]: In([...claves]) }, relations: { detalles: true } });
      const mapa = new Map(filas.map((f) => [f[campo] as string, facturaGql(f)]));
      return claves.map((c) => mapa.get(c) ?? null);
    });
  return { facturaDeOrden: porClave('ordenId'), facturaDeReserva: porClave('reservaExternaId') };
}
