import { describe, expect, it } from 'vitest';
import type { AdminReserva } from '../../src/api/endpoints/admin';
import { ProblemDetailsError } from '../../src/api/problem-details';
import { adminErrorMessage } from '../../src/features/admin/admin-errors';
import { flightStatusBody, flightStatusSchema } from '../../src/features/admin/admin-schemas';
import { checkInState, EMPTY_SEARCH, maskDocument, sharedIdsOf, sharedTravellers, toReservasFilters } from '../../src/features/admin/reservas';

const booking = (id: string, pnr: string, travellers: string[], checkIns: boolean[] = []): AdminReserva => ({
  bookingId: id,
  pnr,
  status: 'CONFIRMED',
  canal: 'SOCIO',
  socio: { partnerId: 'booking', partnerOrderId: 'ORD-BKP-1' },
  paymentReference: 'PAY-BKP-1',
  paymentProvider: null,
  total: { currency: 'USD', total: '100.00' },
  creadaEn: '2026-11-05T10:00:00.000Z',
  vuelos: [],
  pasajeros: travellers.map((t, i) => ({
    passengerId: `${id}-${i}`,
    travellerId: t,
    nombre: `P ${t}`,
    tipoDocumento: 'NATIONAL_ID',
    documento: '*******065',
    asientos: [],
    checkIn: checkIns[i] ?? false,
  })),
  billetes: travellers.length,
});

describe('toReservasFilters', () => {
  it('drops empty values and uppercases the PNR', () => {
    expect(toReservasFilters({ ...EMPTY_SEARCH, pnr: ' abc123 ' })).toEqual({ pnr: 'ABC123' });
  });
  it('sends the document with its type and nationality (EC by default)', () => {
    expect(toReservasFilters({ ...EMPTY_SEARCH, documento: '1710034065' })).toEqual({ documento: '1710034065', tipoDocumento: 'NATIONAL_ID', nacionalidad: 'EC' });
    expect(toReservasFilters({ ...EMPTY_SEARCH, documento: 'A123', tipoDocumento: 'PASSPORT', nacionalidad: 'co', canal: 'SOCIO' })).toMatchObject({
      tipoDocumento: 'PASSPORT',
      nacionalidad: 'CO',
      canal: 'SOCIO',
    });
  });
  it('does not send the type without a document', () => {
    expect(toReservasFilters({ ...EMPTY_SEARCH, tipoDocumento: 'PASSPORT' })).toEqual({});
  });
});

describe('maskDocument', () => {
  it('keeps what the API already masked and masks anything else', () => {
    expect(maskDocument('*******065')).toBe('*******065');
    expect(maskDocument('1710034065')).toBe('*******065');
    expect(maskDocument('12')).toBe('***');
    expect(maskDocument('')).toBe('—');
  });
});

describe('shared travellers', () => {
  it('finds the traveller that appears in two bookings', () => {
    const items = [booking('b1', 'AAA111', ['t1', 't2']), booking('b2', 'BBB222', ['t1'])];
    const shared = sharedTravellers(items);
    expect(shared).toHaveLength(1);
    expect(shared[0]).toMatchObject({ travellerId: 't1', pnrs: ['AAA111', 'BBB222'] });
    expect([...sharedIdsOf(items[0], shared)]).toEqual(['t1']);
  });
  it('ignores a traveller listed twice in the same booking', () => {
    expect(sharedTravellers([booking('b1', 'AAA111', ['t1', 't1'])])).toHaveLength(0);
  });
});

describe('checkInState', () => {
  it('is complete, partial or pending', () => {
    expect(checkInState(booking('b', 'X', ['a', 'b'], [true, true]))).toBe('COMPLETO');
    expect(checkInState(booking('b', 'X', ['a', 'b'], [true, false]))).toBe('PARCIAL');
    expect(checkInState(booking('b', 'X', ['a']))).toBe('PENDIENTE');
  });
});

describe('flight status form', () => {
  it('requires the estimated departure when DELAYED', () => {
    expect(flightStatusSchema.safeParse({ status: 'DELAYED', estimatedDepartureAt: '' }).success).toBe(false);
    expect(flightStatusSchema.safeParse({ status: 'BOARDING' }).success).toBe(true);
  });
  it('builds the body with an ISO instant and omits empty fields', () => {
    expect(flightStatusBody({ status: 'DELAYED', estimatedDepartureAt: '2026-11-06T13:30', departureGate: ' B12 ', reason: '' })).toEqual({
      status: 'DELAYED',
      estimatedDepartureAt: '2026-11-06T13:30:00.000Z',
      departureGate: 'B12',
    });
  });
});

describe('counter error messages', () => {
  const problem = (status: number, code: string) => new ProblemDetailsError({ status, code });
  it('explains the 48 h check-in window', () => {
    expect(adminErrorMessage(problem(409, 'CHECK_IN_NOT_AVAILABLE'), 'checkin-reserva')).toMatch(/48 horas/);
    expect(adminErrorMessage(problem(409, 'CONFLICT'), 'checkin-reserva')).toMatch(/48 horas/);
  });
  it('explains an invalid status transition and the missing estimate', () => {
    expect(adminErrorMessage(problem(409, 'INVALID_STATUS_TRANSITION'), 'estado-vuelo')).toMatch(/no es válido/);
    expect(adminErrorMessage(problem(400, 'VALIDATION_FAILED'), 'estado-vuelo')).toMatch(/salida estimada/);
  });
  it('explains a closed cancellation', () => {
    expect(adminErrorMessage(problem(409, 'CUTOFF_PASSED'), 'cancelar-reserva')).toMatch(/cerrada/);
  });
});
