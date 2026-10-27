import type { DomainEvent } from './domain-event-bus';

/** CloudEvents v1.0 as the contract v2 defines them: `type` = `ec.edu.epn.booking.vuelos.<event>`, extension `correlationid`. */
export const CLOUD_EVENT_TYPE_PREFIX = 'ec.edu.epn.booking.vuelos.';

/** The 15 events a subscriber can ask for and the outbox feed lists (contract v2 `VuelosEventName`). */
export const VUELOS_EVENT_NAMES = [
  'hold.created',
  'hold.expired',
  'booking.confirmed',
  'booking.failed',
  'booking.changed',
  'booking.cancelled',
  'booking.baggage_added',
  'booking.seat_changed',
  'booking.ticket_issuing',
  'booking.ticket_issued',
  'booking.ticket_failed',
  'booking.checked_in',
  'flight.status_changed',
  'flight.schedule_changed',
  'flight.cancelled',
] as const;
export type VuelosEventName = (typeof VUELOS_EVENT_NAMES)[number];

export interface CloudEvent {
  specversion: '1.0';
  type: string;
  source: string;
  id: string;
  time: string;
  subject: string;
  datacontenttype: 'application/json';
  correlationid: string;
  data: Record<string, unknown>;
}

export function isVuelosEventName(type: string): type is VuelosEventName {
  return (VUELOS_EVENT_NAMES as readonly string[]).includes(type);
}

const pick = (payload: Record<string, unknown>, keys: string[]): Record<string, unknown> =>
  Object.fromEntries(keys.filter((k) => payload[k] !== undefined && payload[k] !== null).map((k) => [k, payload[k]]));

/** `BookingEventData` plus the facts each booking event adds. */
function bookingData(payload: Record<string, unknown>): Record<string, unknown> {
  return pick(payload, ['bookingId', 'pnr', 'status', 'ownerId', 'partnerOrderId', 'packageId', 'grandTotal']);
}

/** The `data` object the contract defines for an event type, built from the internal payload. */
export function cloudEventData(type: VuelosEventName, payload: Record<string, unknown>, occurredAt: string): Record<string, unknown> {
  switch (type) {
    case 'hold.created':
      return pick(payload, ['holdId', 'offerId', 'seatsHeld', 'expiresAt']);
    case 'hold.expired':
      return { ...pick(payload, ['holdId', 'seatsReleased']), expiredAt: occurredAt };
    case 'booking.failed':
      return { ...bookingData(payload), ...(payload.failureCode ? { errorCode: payload.failureCode } : {}) };
    case 'booking.ticket_issued':
      return { ...bookingData(payload), ...pick(payload, ['paymentReference', 'tickets']) };
    case 'booking.changed':
      return { ...bookingData(payload), changeType: 'DATE_CHANGE', ...pick(payload, ['amountCharged', 'paymentReference']) };
    case 'booking.baggage_added':
      return { ...bookingData(payload), changeType: 'BAGGAGE', ...pick(payload, ['amountCharged', 'paymentReference', 'passengerId', 'quantity', 'totalBaggage']) };
    case 'booking.seat_changed':
      return { ...bookingData(payload), changeType: 'SEAT', ...pick(payload, ['amountCharged', 'paymentReference', 'seats']) };
    case 'booking.cancelled':
      return { ...bookingData(payload), ...pick(payload, ['reasonCode', 'refundId', 'refundAmount', 'seatsReleased']) };
    case 'booking.checked_in':
      return { ...bookingData(payload), ...(payload.checkedInPassengers !== undefined ? { passengersCheckedIn: payload.checkedInPassengers } : {}) };
    case 'flight.status_changed':
      return {
        ...pick(payload, ['flightNumber', 'date', 'previousStatus', 'estimatedDepartureAt', 'estimatedArrivalAt', 'delayMinutes', 'destination', 'affectedBookingIds']),
        ...(payload.status !== undefined ? { newStatus: payload.status } : {}),
      };
    case 'flight.schedule_changed':
    case 'flight.cancelled':
      return { ...pick(payload, ['codigoVuelo', 'status', 'newDepartureAt']), ...(payload.codigoVuelo ? { flightNumber: payload.codigoVuelo } : {}) };
    default:
      return bookingData(payload);
  }
}

/** The CloudEvent of a domain event, or null when the type is not one the contract publishes. */
export function toCloudEvent(event: DomainEvent, source: string): CloudEvent | null {
  if (!isVuelosEventName(event.type)) return null;
  return {
    specversion: '1.0',
    type: `${CLOUD_EVENT_TYPE_PREFIX}${event.type}`,
    source,
    id: event.id,
    time: event.occurredAt,
    subject: event.aggregateId,
    datacontenttype: 'application/json',
    correlationid: event.correlationId,
    data: cloudEventData(event.type, event.payload as Record<string, unknown>, event.occurredAt),
  };
}

/** The short event name inside a CloudEvent type (`ec.edu.epn.booking.vuelos.booking.confirmed` → `booking.confirmed`). */
export function shortEventName(cloudType: string): string {
  return cloudType.startsWith(CLOUD_EVENT_TYPE_PREFIX) ? cloudType.slice(CLOUD_EVENT_TYPE_PREFIX.length) : cloudType;
}
