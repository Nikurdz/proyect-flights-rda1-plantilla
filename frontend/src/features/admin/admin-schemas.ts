import { z } from 'zod';

const E164 = /^\+[1-9]\d{6,14}$/;
const FLIGHT_CODE = /^[A-Z0-9]{2}\d{1,4}$/;
const IATA = /^[A-Z]{3}$/;

/** Today as YYYY-MM-DD in the browser's calendar. */
function todayIso(reference: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${reference.getFullYear()}-${p(reference.getMonth() + 1)}-${p(reference.getDate())}`;
}

/** A `datetime-local` value (YYYY-MM-DDTHH:mm), read as UTC because the back office shows UTC, to ISO. */
export function utcLocalToIso(value: string): string {
  return new Date(`${value}:00Z`).toISOString();
}

/** ISO instant to the `datetime-local` format, in UTC. */
export function isoToUtcLocal(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16);
}

const futureUtc = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const t = Date.parse(`${value}:00Z`);
  return !Number.isNaN(t) && t > Date.now();
};

export const newUserSchema = z.object({
  correo: z.string().trim().min(1, 'Ingresa el correo.').email('Ingresa un correo válido.').max(150, 'Es demasiado largo.'),
  contrasena: z
    .string()
    .min(10, 'Usa al menos 10 caracteres.')
    .max(128, 'Usa como máximo 128 caracteres.')
    .regex(/[A-Za-z]/, 'Incluye al menos una letra.')
    .regex(/\d/, 'Incluye al menos un número.'),
  nombres: z.string().trim().min(1, 'Ingresa los nombres.').max(100, 'Es demasiado largo.'),
  apellidos: z.string().trim().min(1, 'Ingresa los apellidos.').max(100, 'Es demasiado largo.'),
  fechaNacimiento: z
    .string()
    .min(1, 'Ingresa la fecha de nacimiento.')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingresa una fecha válida.')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Ingresa una fecha válida.')
    .refine((v) => v < todayIso(), 'La fecha de nacimiento debe ser pasada.'),
  telefono: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || E164.test(v), 'Usa el formato internacional, por ejemplo +593999999999.'),
  esAdmin: z.boolean().optional(),
});
export type NewUserForm = z.infer<typeof newUserSchema>;

const price = z
  .string()
  .trim()
  .min(1, 'Ingresa el precio.')
  .regex(/^\d+([.,]\d{1,2})?$/, 'Usa un número con hasta 2 decimales.')
  .refine((v) => Number(v.replace(',', '.')) > 0, 'El precio debe ser mayor que cero.');

const minutes = z
  .string()
  .trim()
  .min(1, 'Ingresa la duración.')
  .regex(/^\d+$/, 'Usa un número entero de minutos.')
  .refine((v) => Number(v) >= 20 && Number(v) <= 1500, 'La duración debe estar entre 20 y 1500 minutos.');

const capacity = z
  .string()
  .trim()
  .regex(/^\d+$/, 'Usa un número entero.')
  .refine((v) => Number(v) >= 1 && Number(v) <= 400, 'La capacidad debe estar entre 1 y 400 asientos.');

const airline = z.string().trim().min(2, 'Ingresa la aerolínea (mínimo 2 letras).').max(150, 'Es demasiado largo.');

export const newFlightSchema = z
  .object({
    codigoVuelo: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine((v) => FLIGHT_CODE.test(v), 'Usa 2 letras o dígitos y de 1 a 4 números, por ejemplo LA900.'),
    aerolinea: airline,
    origen: z.string().regex(IATA, 'Elige el aeropuerto de origen.'),
    destino: z.string().regex(IATA, 'Elige el aeropuerto de destino.'),
    salida: z.string().min(1, 'Ingresa la fecha y hora de salida.').refine(futureUtc, 'La salida debe ser una fecha y hora futuras.'),
    duracionMinutos: minutes,
    precioBaseUsd: price,
    capacidad: capacity.or(z.literal('')),
  })
  .refine((d) => !d.origen || d.origen !== d.destino, { path: ['destino'], message: 'El destino debe ser distinto del origen.' });
export type NewFlightForm = z.infer<typeof newFlightSchema>;

/** Every field is optional on the API, but at least the form keeps valid values. */
export const editFlightSchema = z.object({
  aerolinea: airline,
  precioBaseUsd: price,
  duracionMinutos: minutes,
  capacidadTotal: capacity,
});
export type EditFlightForm = z.infer<typeof editFlightSchema>;

export const rescheduleSchema = z.object({
  nuevaSalida: z.string().min(1, 'Ingresa la nueva fecha y hora de salida.').refine(futureUtc, 'La nueva salida debe ser futura.'),
  motivo: z.string().trim().max(300, 'Usa como máximo 300 caracteres.').optional(),
});
export type RescheduleForm = z.infer<typeof rescheduleSchema>;

export const cancelFlightSchema = z.object({
  motivo: z.string().trim().max(300, 'Usa como máximo 300 caracteres.').optional(),
});

export const toNumber = (v: string) => Number(v.replace(',', '.'));
