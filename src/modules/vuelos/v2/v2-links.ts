/** HATEOAS links of contract v2 (`_links`): hrefs are relative to the server (/api/v2). */
export interface Link {
  href: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
}
export type Links = Record<string, Link>;

const base = '/api/v2/vuelos';

export const holdLinks = (holdId: string): Links => ({
  self: { href: `${base}/offers/hold/${holdId}`, method: 'GET' },
  release: { href: `${base}/offers/hold/${holdId}`, method: 'DELETE' },
  createBooking: { href: `${base}/bookings`, method: 'POST' },
});

export const bookingLinks = (bookingId: string, status: string): Links => {
  const links: Links = {
    self: { href: `${base}/bookings/${bookingId}`, method: 'GET' },
    tickets: { href: `${base}/bookings/${bookingId}/tickets`, method: 'GET' },
  };
  if (status === 'CONFIRMED') {
    links.baggageOptions = { href: `${base}/bookings/${bookingId}/baggage-options`, method: 'GET' };
    links.changeSeats = { href: `${base}/bookings/${bookingId}/seats`, method: 'PUT' };
    links.checkIn = { href: `${base}/bookings/${bookingId}/check-in`, method: 'POST' };
    links.cancellationQuote = { href: `${base}/bookings/${bookingId}/cancellation-quote`, method: 'GET' };
    links.cancel = { href: `${base}/bookings/${bookingId}/cancel`, method: 'POST' };
  }
  return links;
};

export const checkInLinks = (bookingId: string): Links => ({
  self: { href: `${base}/bookings/${bookingId}/check-in`, method: 'POST' },
  boardingPasses: { href: `${base}/bookings/${bookingId}/boarding-passes`, method: 'GET' },
  booking: { href: `${base}/bookings/${bookingId}`, method: 'GET' },
});
