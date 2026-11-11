import { QueryFailedError } from 'typeorm';
import { mapBookingUniqueViolation, seatTakenProblem } from './db-errors';
import { ProblemDetailsException } from './problem-details.exception';

const violation = (detail: string): QueryFailedError => {
  return new QueryFailedError('INSERT', [], Object.assign(new Error('duplicate key'), { code: '23505', detail }));
};

describe('seat conflicts', () => {
  it('names the seat and the segment in v2 and keeps the generic text in v1', () => {
    const problem = seatTakenProblem('12A', 'SEG-1');
    expect(problem.getStatus()).toBe(409);
    expect(problem.getResponse()).toMatchObject({ code: 'SEAT_TAKEN', title: 'Seat already taken' });
    expect(problem.v2).toMatchObject({ code: 'SEAT_TAKEN', status: 409, title: 'Asiento no disponible', detail: 'El asiento 12A del segmento SEG-1 ya fue tomado.' });
  });

  it('reads the seat and the flight from the unique violation of the database', () => {
    const mapped = mapBookingUniqueViolation(violation('Key ("vueloId", "seatNumber")=(7a1c0c52-0000-4000-8000-000000000001, 12A) already exists.')) as ProblemDetailsException;
    expect(mapped).toBeInstanceOf(ProblemDetailsException);
    expect(mapped.v2?.detail).toBe('El asiento 12A del segmento 7a1c0c52-0000-4000-8000-000000000001 ya fue tomado.');
  });

  it('falls back to a generic detail when the database does not say which seat', () => {
    const mapped = mapBookingUniqueViolation(violation('Key (seatNumber)=() already exists.')) as ProblemDetailsException;
    expect(mapped.v2?.detail).toContain('asientos solicitados');
  });

  it('leaves any other error untouched', () => {
    const other = new Error('boom');
    expect(mapBookingUniqueViolation(other)).toBe(other);
  });
});
