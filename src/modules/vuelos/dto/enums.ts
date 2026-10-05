// Single source of truth for the contract's closed value sets, shared by validators and Swagger.

export const CABIN_CLASSES = ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'] as const;
export const PASSENGER_TYPE_VALUES = ['ADULT', 'YOUTH', 'CHILD', 'INFANT'] as const;
export const DOCUMENT_TYPES = ['PASSPORT', 'NATIONAL_ID'] as const;
export const GENDERS = ['M', 'F', 'X'] as const;

export const WEBHOOK_EVENTS = [
  'booking.confirmed',
  'booking.failed',
  'booking.changed',
  'booking.cancelled',
  'booking.baggage_added',
  'hold.expired',
  'flight.schedule_changed',
  'flight.cancelled',
  'booking.ticket_issuing',
  'booking.ticket_issued',
  'booking.ticket_failed',
  'booking.checked_in',
] as const;
