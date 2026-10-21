import { z } from 'zod';

const E164 = /^\+[1-9]\d{6,14}$/;
const MIN_AGE = 18;

/** Whole years between a birth date (YYYY-MM-DD) and a reference date. */
export function ageOn(birthDate: string, reference: Date = new Date()): number {
  const [y, m, d] = birthDate.split('-').map(Number);
  let age = reference.getFullYear() - y;
  const hadBirthday = reference.getMonth() + 1 > m || (reference.getMonth() + 1 === m && reference.getDate() >= d);
  if (!hadBirthday) age -= 1;
  return age;
}

/**
 * The same rules the API enforces (so the person finds out before sending), plus being an adult,
 * which the terms of use require.
 */
export const registrationSchema = z
  .object({
    correo: z.string().trim().min(1, 'Ingresa tu correo.').email('Ingresa un correo válido.').max(150, 'Es demasiado largo.'),
    contrasena: z
      .string()
      .min(10, 'Usa al menos 10 caracteres.')
      .max(128, 'Usa como máximo 128 caracteres.')
      .regex(/[A-Za-z]/, 'Incluye al menos una letra.')
      .regex(/\d/, 'Incluye al menos un número.'),
    confirmacion: z.string().min(1, 'Repite tu contraseña.'),
    nombres: z.string().trim().min(1, 'Ingresa tus nombres.').max(100, 'Es demasiado largo.'),
    apellidos: z.string().trim().min(1, 'Ingresa tus apellidos.').max(100, 'Es demasiado largo.'),
    fechaNacimiento: z
      .string()
      .min(1, 'Ingresa tu fecha de nacimiento.')
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingresa una fecha válida.')
      .refine((value) => !Number.isNaN(Date.parse(value)), 'Ingresa una fecha válida.')
      .refine((value) => ageOn(value) >= MIN_AGE, `Debes ser mayor de ${MIN_AGE} años para crear una cuenta.`)
      .refine((value) => ageOn(value) <= 120, 'Revisa la fecha de nacimiento.'),
    telefono: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || E164.test(value), 'Usa el formato internacional, por ejemplo +593999999999.'),
    aceptaTerminos: z.boolean().refine((value) => value === true, 'Debes aceptar los términos y la política de privacidad.'),
    consentimientoMarketing: z.boolean().optional(),
  })
  .refine((data) => data.contrasena === data.confirmacion, {
    path: ['confirmacion'],
    message: 'Las contraseñas no coinciden.',
  });

export type RegistrationForm = z.infer<typeof registrationSchema>;
