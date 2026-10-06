/** Spanish labels for the values the API sends as codes. Unknown values fall back to a neutral text. */

const ORDER_STATUS: Record<string, string> = {
  PENDIENTE_PAGO: 'Pendiente de pago',
  PAGO_EN_VERIFICACION: 'Pago en verificación',
  PAGADA: 'Pagada',
  EMITIDA: 'Confirmada',
  FALLIDA_COMPENSADA: 'No emitida (sin cobro)',
  MODIFICADA: 'Modificada',
  DEVOLUCION_EN_CURSO: 'Reembolso en curso',
  REEMBOLSADA: 'Reembolsada',
  EN_VIAJE: 'En viaje',
  COMPLETADA: 'Completada',
  EXPIRADA: 'Vencida',
};

const PASSENGER_TYPE: Record<string, string> = {
  ADULT: 'Adulto',
  YOUTH: 'Joven',
  CHILD: 'Niño',
  INFANT: 'Infante',
};

const FARE_FAMILY: Record<string, string> = {
  BASIC: 'Basic',
  LIGHT: 'Light',
  FULL: 'Full',
};

export const orderStatusLabel = (status: string): string => ORDER_STATUS[status] ?? 'En proceso';
export const passengerTypeLabel = (type: string): string => PASSENGER_TYPE[type] ?? 'Pasajero';
export const fareFamilyLabel = (code: string): string => FARE_FAMILY[code] ?? code;

/** Tailwind classes for a status pill. */
export function orderStatusTone(status: string): string {
  switch (status) {
    case 'EMITIDA':
    case 'COMPLETADA':
    case 'EN_VIAJE':
      return 'bg-emerald-100 text-emerald-800';
    case 'FALLIDA_COMPENSADA':
    case 'EXPIRADA':
      return 'bg-red-100 text-red-800';
    case 'PENDIENTE_PAGO':
    case 'PAGO_EN_VERIFICACION':
    case 'PAGADA':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

/** "2026-10-15T13:00:00.000Z" -> "15 oct 2026, 08:00" in the given IANA time zone (default: UTC). */
export function formatDateTime(iso: string, timeZone: string = 'UTC'): string {
  try {
    return new Intl.DateTimeFormat('es-EC', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDay(iso: string, timeZone: string = 'UTC'): string {
  try {
    return new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}
