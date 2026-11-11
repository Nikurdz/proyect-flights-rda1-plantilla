import type { TipoServicio } from '../entities/proveedor.entity';

/** A partner product in the platform's own vocabulary (the anti-corruption layer translates the partner's contract into this). */
export interface ProductoExterno {
  externalId: string;
  tipo: string;
  nombre: string;
  descripcion: string;
  duracion: string | null;
  precioMinor: number;
  moneda: string;
  imagenUrl: string | null;
  cancelacionGratis: boolean;
  categorias: string[];
}

export interface DatosReservaExterna {
  fecha: string;
  hora: string | null;
  cantidad: number;
  nombre: string;
  correo: string;
}

export interface ReservaRemota {
  reservationId: string;
  estado: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
  /** The total the partner charges, in minor units, when it says. */
  totalMinor: number | null;
}

/** The business answer of a partner that refused a request (4xx): not a failure of the service. */
export class RechazoProveedorError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** What the platform needs from a partner, whatever its contract looks like. One implementation per service type. */
export interface AdaptadorProveedor {
  readonly tipo: TipoServicio;
  /** A cheap request that proves the service is up. Returns the latency in ms. */
  ping(baseUrl: string): Promise<number>;
  /** The partner catalogue, at most `max` products. */
  catalogo(baseUrl: string, max: number): Promise<ProductoExterno[]>;
  reservar(baseUrl: string, externalId: string, datos: DatosReservaExterna, idempotencyKey: string): Promise<ReservaRemota>;
  cancelar(baseUrl: string, reservationId: string, motivo: string, idempotencyKey: string): Promise<void>;
}
