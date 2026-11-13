import { z } from 'zod';
import {
  ageAtDate,
  ageRangeMessage,
  expectedTypeForAge,
  expiresAfterLastFlight,
  isFutureDate,
  isOlderThanMax,
  isRealCalendarDate,
  isValidEcuadorCedula,
  normalizeDocumentNumber,
  normalizePersonName,
  type PassengerType,
} from '../../lib/passenger-rules';

const passengerSchema = z.object({
  id: z.string(),
  tipo: z.enum(['ADULT', 'YOUTH', 'CHILD', 'INFANT']),
  nombres: z.string().min(2, 'Ingresa al menos 2 letras').trim(),
  apellidos: z.string().min(2, 'Ingresa al menos 2 letras').trim(),
  fechaNacimiento: z.string().min(10, 'Ingresa la fecha de nacimiento.'),
  genero: z.enum(['M', 'F', 'X']),
  nacionalidad: z.string().min(2, 'Selecciona la nacionalidad'),
  documento: z.object({
    tipo: z.enum(['PASSPORT', 'NATIONAL_ID']),
    numero: z.string().min(4, 'Mínimo 4 caracteres').trim(),
    vencimiento: z.string().optional(),
  }),
  numeroSocio: z.string().optional(),
  asociadoA: z.string().optional(),
});

/** What the offer says about the trip: the rules that depend on it. */
export interface PassengerRulesContext {
  /** UTC day (YYYY-MM-DD) of the first flight: ages are measured here. */
  firstFlightDay: string;
  /** UTC day of the last flight: the type must still hold and the document must outlast it. */
  lastFlightDay: string;
  /** Some leg crosses a border (or an airport is unknown): the document expiry is required. */
  international: boolean;
  /** Today in Ecuador. */
  today: string;
  /** Passenger ids by row (the API ids: `ADT-1`...), as the form keeps its own keys for the rows. */
  ids?: readonly string[];
}

export const contactSchema = z.object({
  correo: z.string().email('Ingresa un correo electrónico válido'),
  // People type "+593 99 123 4567": spaces, dashes and parentheses are dropped before checking the international format.
  telefono: z
    .string()
    .transform((value) => value.replace(/[\s\-().]/g, ''))
    .pipe(
      z
        .string()
        .min(8, 'Ingresa un teléfono con código de país, por ejemplo +593 99 123 4567.')
        .regex(/^\+[1-9]\d{6,14}$/, 'Empieza con "+" y el código de país, por ejemplo +593 99 123 4567.'),
    ),
});

/** The form schema for one offer: field rules plus the cross-checks that need the whole party and the trip. */
export function buildPassengerFormSchema(context: PassengerRulesContext) {
  return z
    .object({ pasajeros: z.array(passengerSchema), contacto: contactSchema })
    .superRefine((form, ctx) => {
      const problem = (index: number, path: (string | number)[], message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ['pasajeros', index, ...path] });

      const idOf = (index: number) => context.ids?.[index] ?? form.pasajeros[index].id;
      const adults = new Set(form.pasajeros.flatMap((p, index) => (p.tipo === 'ADULT' ? [idOf(index)] : [])));
      const seenDocuments = new Map<string, number>();
      const seenPeople = new Map<string, number>();
      const infantsPerAdult = new Map<string, number>();

      form.pasajeros.forEach((p, index) => {
        const birth = p.fechaNacimiento;
        if (birth.length >= 10) {
          if (!isRealCalendarDate(birth)) {
            problem(index, ['fechaNacimiento'], 'Ingresa una fecha de nacimiento válida.');
          } else if (isFutureDate(birth, context.today)) {
            problem(index, ['fechaNacimiento'], 'La fecha de nacimiento no puede ser futura.');
          } else if (isOlderThanMax(birth, context.today)) {
            problem(index, ['fechaNacimiento'], 'Revisa la fecha de nacimiento (más de 120 años).');
          } else {
            const type = p.tipo as PassengerType;
            const ageFirst = ageAtDate(birth, context.firstFlightDay);
            const ageLast = ageAtDate(birth, context.lastFlightDay);
            if (expectedTypeForAge(ageFirst) !== type) {
              problem(index, ['fechaNacimiento'], `${ageRangeMessage(type)}. Con esta fecha tendrá ${ageFirst} años.`);
            } else if (expectedTypeForAge(ageLast) !== type) {
              problem(
                index,
                ['fechaNacimiento'],
                `El tipo cambia antes del último vuelo: ese día tendrá ${ageLast} años y ya no será ${ageRangeMessage(type, 'en todo el viaje')}.`,
              );
            }
          }
        }

        const doc = p.documento;
        const number = doc.numero.trim();
        if (doc.tipo === 'NATIONAL_ID' && p.nacionalidad.toUpperCase() === 'EC' && number.length >= 4 && !isValidEcuadorCedula(number)) {
          problem(index, ['documento', 'numero'], 'La cédula no es válida: revisa los 10 dígitos y el dígito verificador.');
        }

        const expiry = doc.vencimiento ?? '';
        if (!expiry) {
          if (context.international) problem(index, ['documento', 'vencimiento'], 'Ingresa el vencimiento del documento: el viaje cruza fronteras.');
        } else if (!isRealCalendarDate(expiry)) {
          problem(index, ['documento', 'vencimiento'], 'Ingresa una fecha de vencimiento válida.');
        } else if (!expiresAfterLastFlight(expiry, context.lastFlightDay)) {
          problem(index, ['documento', 'vencimiento'], 'El documento debe vencer después del último vuelo del viaje.');
        }

        if (number.length >= 4) {
          const key = normalizeDocumentNumber(number);
          if (seenDocuments.has(key)) problem(index, ['documento', 'numero'], 'Este documento ya está en otro pasajero de la reserva.');
          else seenDocuments.set(key, index);
        }
        if (p.nombres.trim().length >= 2 && p.apellidos.trim().length >= 2 && birth.length >= 10) {
          const key = `${normalizePersonName(p.nombres)}|${normalizePersonName(p.apellidos)}|${birth}`;
          if (seenPeople.has(key)) problem(index, ['nombres'], 'Esta persona ya aparece en la reserva (mismo nombre y fecha de nacimiento).');
          else seenPeople.set(key, index);
        }

        if (p.tipo === 'INFANT') {
          if (!p.asociadoA || !adults.has(p.asociadoA)) {
            problem(index, ['asociadoA'], 'Elige el adulto con el que viaja el infante.');
          } else {
            const count = (infantsPerAdult.get(p.asociadoA) ?? 0) + 1;
            infantsPerAdult.set(p.asociadoA, count);
            if (count > 1) problem(index, ['asociadoA'], 'Un adulto puede llevar como máximo un infante: elige otro adulto.');
          }
        }
      });
    });
}

export type PassengerFormValues = z.infer<ReturnType<typeof buildPassengerFormSchema>>;
