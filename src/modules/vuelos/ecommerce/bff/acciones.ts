import { checkInWindow, hasDeparted, isBeforeCutoff } from '../../common/postsale-rules';
import type { EstadoOrden } from '../ordenes/entities/orden.entity';

export type CodigoAccion = 'CHECKIN' | 'CANCELAR';

export interface AccionOrden {
  codigo: CodigoAccion;
  metodo: 'GET' | 'POST';
  href: string;
  requiereIdempotencia: boolean;
}

export interface ReglasAcciones {
  cutoffHours: number;
  checkInOpensHours: number;
  checkInClosesHours: number;
}

export interface EntradaAcciones {
  estado: EstadoOrden;
  bookingId?: string | null;
  /** Departure of every leg of the trip as it stands now. */
  salidas: Date[];
  ahora: Date;
  reglas: ReglasAcciones;
}

/**
 * The actions a client may offer for an order right now. It only reads the same pure rules the after-sale services
 * enforce (`postsale-rules`), so it is a hint for the screen: the real endpoints still validate everything and the
 * order's state machine stays in the domain.
 */
export function accionesOrden(entrada: EntradaAcciones): AccionOrden[] {
  const { estado, bookingId, salidas, ahora, reglas } = entrada;
  if (estado !== 'EMITIDA' || !bookingId || salidas.length === 0) return [];

  const acciones: AccionOrden[] = [];
  if (salidas.some((s) => checkInWindow(s, ahora, reglas.checkInOpensHours, reglas.checkInClosesHours) === 'OPEN')) {
    acciones.push({ codigo: 'CHECKIN', metodo: 'POST', href: `/api/v1/bookings/${bookingId}/check-in`, requiereIdempotencia: true });
  }
  const primeraSalida = salidas.reduce((min, s) => (s.getTime() < min.getTime() ? s : min));
  if (!hasDeparted(primeraSalida, ahora) && isBeforeCutoff(primeraSalida, ahora, reglas.cutoffHours)) {
    acciones.push({ codigo: 'CANCELAR', metodo: 'POST', href: `/api/v1/bookings/${bookingId}/cancel`, requiereIdempotencia: true });
  }
  return acciones;
}
