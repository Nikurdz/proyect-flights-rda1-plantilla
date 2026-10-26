import { z } from 'zod';
import { ProblemDetailsError } from '../api/problem-details';
import type { EstadoReservaExterna, MontoDto } from '../api/types';

/** Spanish labels and tones for a reservation of an experience. */
const ESTADOS: Record<EstadoReservaExterna, { label: string; className: string }> = {
  PENDIENTE: { label: 'Pendiente', className: 'bg-amber-100 text-amber-800' },
  CONFIRMADA: { label: 'Confirmada', className: 'bg-emerald-100 text-emerald-800' },
  CANCELADA: { label: 'Cancelada', className: 'bg-slate-100 text-slate-700' },
  FALLIDA_COMPENSADA: { label: 'No realizada (sin cobro)', className: 'bg-red-100 text-red-800' },
};

export function estadoReserva(estado: string): { label: string; className: string } {
  return ESTADOS[estado as EstadoReservaExterna] ?? { label: 'En proceso', className: 'bg-slate-100 text-slate-700' };
}

/** Cancellation is offered only for confirmed bookings of an experience with free cancellation. */
export const puedeCancelarReserva = (estado: string, cancelacionGratis: boolean | undefined): boolean => estado === 'CONFIRMADA' && cancelacionGratis === true;

/** A confirmed booking that cannot be cancelled for free: the screen says so instead of offering the button. */
export const sinCancelacionGratis = (estado: string, cancelacionGratis: boolean | undefined): boolean => estado === 'CONFIRMADA' && cancelacionGratis !== true;

export const TEXTO_SIN_CANCELACION_GRATIS = 'Esta experiencia no admite cancelación gratuita';

/** Today as YYYY-MM-DD in the browser's calendar. */
export function todayIso(reference: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${reference.getFullYear()}-${p(reference.getMonth() + 1)}-${p(reference.getDate())}`;
}

/** Total shown before paying: price per person times people, in integer cents so there is no float drift. */
export function totalEstimado(precio: MontoDto, cantidad: number): MontoDto {
  const cents = Math.round(Number(precio.monto) * 100) * cantidad;
  return { moneda: precio.moneda, monto: (cents / 100).toFixed(2) };
}

export const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Booking data (the card is validated separately by `lib/cards`; its number never reaches this schema). */
export const reservaSchema = z.object({
  fecha: z
    .string()
    .min(1, 'Elige la fecha de la experiencia.')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingresa una fecha válida.')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Ingresa una fecha válida.')
    .refine((v) => v >= todayIso(), 'La fecha no puede ser pasada.'),
  hora: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || HORA_REGEX.test(v), 'Usa el formato HH:MM, por ejemplo 10:30.'),
  cantidad: z.coerce
    .number({ invalid_type_error: 'Indica cuántas personas.' })
    .int('Usa un número entero.')
    .min(1, 'Mínimo 1 persona.')
    .max(10, 'Máximo 10 personas por reserva.'),
  nombre: z.string().trim().min(2, 'Ingresa tu nombre completo.').max(150, 'Es demasiado largo.'),
  correo: z.string().trim().min(1, 'Ingresa tu correo.').email('Ingresa un correo válido.').max(150, 'Es demasiado largo.'),
  tipoIdentificacion: z.string().min(1, 'Selecciona el tipo de identificación.'),
  numeroIdentificacion: z
    .string()
    .trim()
    .min(3, 'Ingresa el número de identificación fiscal.')
    .regex(/^[A-Za-z0-9.-]{3,30}$/, 'Usa solo letras, números, punto o guion (máximo 30).'),
  razonSocial: z.string().trim().min(2, 'Ingresa el nombre o razón social.').max(200, 'Es demasiado largo.'),
  direccion: z.string().trim().min(3, 'Ingresa la dirección fiscal.').max(250, 'Es demasiado larga.'),
  pais: z.string().min(2, 'Selecciona el país fiscal.'),
});
export type ReservaForm = z.input<typeof reservaSchema>;
export type ReservaValues = z.output<typeof reservaSchema>;

/**
 * Checks a tax id against the pattern of its type as the market publishes it. The server decides in the end;
 * an unreadable pattern never blocks the person (returns null = no complaint).
 */
export function validateTaxId(numero: string, patron: string | undefined): string | null {
  if (!patron) return null;
  try {
    return new RegExp(`^(?:${patron})$`).test(numero) ? null : 'El número no corresponde al tipo de identificación elegido.';
  } catch {
    return null;
  }
}

/**
 * Outcomes the server stores under the Idempotency-Key (a declined payment, a compensated reservation) or that
 * invalidate the attempt (price changed): after one of these a NEW attempt needs a NEW key.
 */
export function consumesKey(error: unknown): boolean {
  if (!(error instanceof ProblemDetailsError)) return false;
  return error.status === 402 || error.code === 'EXTERNAL_RESERVATION_FAILED_COMPENSATED' || error.code === 'PRICE_CHANGED';
}
