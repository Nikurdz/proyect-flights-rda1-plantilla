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
      return 'bg-success-soft text-success';
    case 'FALLIDA_COMPENSADA':
    case 'EXPIRADA':
      return 'bg-danger-soft text-danger';
    case 'PENDIENTE_PAGO':
    case 'PAGO_EN_VERIFICACION':
    case 'PAGADA':
      return 'bg-warning-soft text-warning';
    default:
      return 'bg-line text-ink';
  }
}

/** Time zone of the whole system: Ecuador (UTC-5, no daylight saving). Every screen shows and every form takes Ecuador time. */
export const SYSTEM_TIME_ZONE = 'America/Guayaquil';
/** Same zone, as the back office names it. */
export const ADMIN_TIME_ZONE = SYSTEM_TIME_ZONE;

/** An instant in the time of Ecuador, for the back office. */
export const formatAdminDateTime = (iso: string): string => formatDateTime(iso, ADMIN_TIME_ZONE);

/** "2026-10-15T13:00:00.000Z" -> "15 oct 2026, 08:00" in the given IANA time zone (default: Ecuador). */
export function formatDateTime(iso: string, timeZone: string = SYSTEM_TIME_ZONE): string {
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

/** Short day for tight spaces: «sáb 14 nov». */
export function formatShortDay(iso: string, timeZone: string = SYSTEM_TIME_ZONE): string {
  try {
    return new Intl.DateTimeFormat('es-EC', { weekday: 'short', day: 'numeric', month: 'short', timeZone })
      .format(new Date(iso))
      .replace(/[.,]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^(\S+) de /, '$1 ')
      .replace(/ de /g, ' ');
  } catch {
    return iso.slice(0, 10);
  }
}

export function formatDay(iso: string, timeZone: string = SYSTEM_TIME_ZONE): string {
  try {
    return new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}
