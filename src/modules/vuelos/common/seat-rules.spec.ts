import { HttpStatus } from '@nestjs/common';
import { ProblemDetailsException } from './problem-details.exception';
import { assertHoldSeats, assertSeatPick, seatKey } from './seat-rules';

const FLIGHT = { id: 'seg-1', capacidadTotal: 12, codigoVuelo: 'RA100' }; // rows 1-2, seats A-F
const OTHER = { id: 'seg-2', capacidadTotal: 12, codigoVuelo: 'RA200' };

const problemOf = (run: () => unknown): { status: number; code: string; invalid?: { name: string }[] } => {
  try {
    run();
  } catch (error) {
    const problem = error as ProblemDetailsException;
    const body = problem.getResponse() as { code: string; invalidParams?: { name: string }[] };
    return { status: problem.getStatus(), code: body.code, invalid: body.invalidParams };
  }
  throw new Error('expected a problem');
};

describe('seat rules', () => {
  const wording = {
    segmentStatus: HttpStatus.UNPROCESSABLE_ENTITY,
    segmentField: 'passengers.assignedSeats.segmentId',
    owner: 'hold',
    duplicateDetail: (seat: string) => `Seat ${seat} twice`,
  };

  it('accepts a seat of one of the flights and remembers it', () => {
    const requested = new Set<string>();
    expect(assertSeatPick({ segmentId: 'seg-1', seatNumber: '2F' }, [FLIGHT], requested, wording)).toBe(FLIGHT);
    expect(requested.has(seatKey({ segmentId: 'seg-1', seatNumber: '2F' }))).toBe(true);
  });

  it('refuses a segment that is not one of the flights with the status of the caller', () => {
    const problem = problemOf(() => assertSeatPick({ segmentId: 'nope', seatNumber: '1A' }, [FLIGHT], new Set(), wording));
    expect(problem).toMatchObject({ status: 422, code: 'VALIDATION_FAILED' });
  });

  it('refuses a seat outside the cabin (422 SEAT_CABIN_MISMATCH) and a seat listed twice (409 SEAT_TAKEN)', () => {
    expect(problemOf(() => assertSeatPick({ segmentId: 'seg-1', seatNumber: '3A' }, [FLIGHT], new Set(), wording))).toMatchObject({ status: 422, code: 'SEAT_CABIN_MISMATCH' });

    const requested = new Set<string>();
    assertSeatPick({ segmentId: 'seg-1', seatNumber: '1A' }, [FLIGHT], requested, wording);
    expect(problemOf(() => assertSeatPick({ segmentId: 'seg-1', seatNumber: '1A' }, [FLIGHT], requested, wording))).toMatchObject({ status: 409, code: 'SEAT_TAKEN' });
  });

  describe('seats of a hold', () => {
    it('accepts nothing, and one seat per seat-taking passenger on each segment', () => {
      expect(() => assertHoldSeats([], [FLIGHT], 2)).not.toThrow();
      expect(() =>
        assertHoldSeats(
          [
            { segmentId: 'seg-1', seatNumber: '1A' },
            { segmentId: 'seg-1', seatNumber: '1B' },
            { segmentId: 'seg-2', seatNumber: '1A' }, // the same number on another flight is another seat
          ],
          [FLIGHT, OTHER],
          2,
        ),
      ).not.toThrow();
    });

    it('answers 400 for a segment outside the offer', () => {
      const problem = problemOf(() => assertHoldSeats([{ segmentId: 'seg-9', seatNumber: '1A' }], [FLIGHT], 1));
      expect(problem).toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
      expect(problem.invalid?.[0].name).toBe('assignedSeats.segmentId');
    });

    it('answers 422 SEAT_CABIN_MISMATCH for a seat that does not exist and 409 SEAT_TAKEN for a repeated one', () => {
      expect(problemOf(() => assertHoldSeats([{ segmentId: 'seg-1', seatNumber: '9A' }], [FLIGHT], 1))).toMatchObject({ status: 422, code: 'SEAT_CABIN_MISMATCH' });
      expect(
        problemOf(() =>
          assertHoldSeats(
            [
              { segmentId: 'seg-1', seatNumber: '1A' },
              { segmentId: 'seg-1', seatNumber: '1A' },
            ],
            [FLIGHT],
            2,
          ),
        ),
      ).toMatchObject({ status: 409, code: 'SEAT_TAKEN' });
    });

    it('refuses more seats on a segment than passengers that take a seat', () => {
      const problem = problemOf(() =>
        assertHoldSeats(
          [
            { segmentId: 'seg-1', seatNumber: '1A' },
            { segmentId: 'seg-1', seatNumber: '1B' },
          ],
          [FLIGHT],
          1,
        ),
      );
      expect(problem).toMatchObject({ status: 422, code: 'VALIDATION_FAILED' });
      expect(problem.invalid?.[0].name).toBe('assignedSeats');
    });
  });
});
