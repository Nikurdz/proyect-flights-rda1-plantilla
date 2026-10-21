import type { PassengerCounts } from '../features/search/PassengerSelector';

/**
 * What decides whether an outbound flight picked on the results page is still valid. The return date is
 * deliberately NOT part of it: changing the return day must keep the outbound the traveller already chose.
 */
export function outboundSelectionKey(params: {
  origin?: string;
  destination?: string;
  outbound?: string;
  trip?: string;
  adt: number;
  chd: number;
  inf: number;
}): string {
  return [params.origin, params.destination, params.outbound, params.trip, params.adt, params.chd, params.inf].join('|');
}

interface SearchPathInput {
  origin: string;
  destination: string;
  outbound: string;
  inbound?: string;
  trip: 'OW' | 'RT';
  passengers: PassengerCounts;
  sort?: string;
}

/** The results URL for a search; children and infants are only written when there are any. */
export function buildSearchPath({ origin, destination, outbound, inbound, trip, passengers, sort }: SearchPathInput): string {
  const query = new URLSearchParams({ origin, destination, outbound });
  if (trip === 'RT' && inbound) query.set('inbound', inbound);
  query.set('trip', trip);
  query.set('adt', String(passengers.adt));
  if (passengers.chd > 0) query.set('chd', String(passengers.chd));
  if (passengers.inf > 0) query.set('inf', String(passengers.inf));
  if (sort) query.set('sort', sort);
  return `/resultados?${query.toString()}`;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "2 adultos, 1 niño, 1 bebé" */
export function describePassengers({ adt, chd, inf }: PassengerCounts): string {
  const parts = [plural(adt, 'adulto', 'adultos')];
  if (chd > 0) parts.push(plural(chd, 'niño', 'niños'));
  if (inf > 0) parts.push(plural(inf, 'bebé', 'bebés'));
  return parts.join(', ');
}
