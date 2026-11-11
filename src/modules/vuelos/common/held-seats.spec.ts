import type { EntityManager } from 'typeorm';
import { FlightHold } from '../entities/flight-hold.entity';
import { FlightHoldSeat } from '../entities/flight-hold-seat.entity';
import { SeatAssignment } from '../entities/seat-assignment.entity';
import { claimHoldSeats, lockSeats, seatHeldByAnotherHold } from './held-seats';
import { ProblemDetailsException } from './problem-details.exception';

// The decisions around a claim, with a mocked manager. The unique index, the row locks and the real race are
// covered by the integration suites (v2.integration.spec.ts).
describe('held seats', () => {
  const SEAT = { segmentId: 'seg-1', seatNumber: '12A' };
  let sold: Partial<SeatAssignment>[];
  let rows: Partial<FlightHoldSeat>[];
  let holds: Partial<FlightHold>[];
  let returned: { vueloId: string; seatNumber: string }[];
  let inserted: unknown[];

  const builder = {
    insert: jest.fn(() => builder),
    into: jest.fn(() => builder),
    values: jest.fn((values: unknown[]) => {
      inserted = values;
      return builder;
    }),
    orIgnore: jest.fn(() => builder),
    returning: jest.fn(() => builder),
    updateEntity: jest.fn(() => builder),
    execute: jest.fn(async () => ({ raw: returned })),
  };
  const mock = {
    find: jest.fn(async (entity: unknown) => (entity === SeatAssignment ? sold : entity === FlightHoldSeat ? rows : entity === FlightHold ? holds : [])),
    delete: jest.fn(async () => ({ affected: 1 })),
    query: jest.fn(async () => []),
    createQueryBuilder: jest.fn(() => builder),
  };
  const manager = mock as unknown as EntityManager;

  const codeOf = async (work: Promise<unknown>): Promise<string> => {
    const error = (await work.catch((e: unknown) => e)) as ProblemDetailsException;
    expect(error).toBeInstanceOf(ProblemDetailsException);
    expect(error.getStatus()).toBe(409);
    return (error.getResponse() as { code: string }).code;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sold = [];
    rows = [];
    holds = [];
    inserted = [];
    returned = [{ vueloId: 'seg-1', seatNumber: '12A' }];
  });

  it('sets a free seat aside', async () => {
    await claimHoldSeats(manager, 'hold-1', [SEAT]);
    expect(inserted).toEqual([{ holdId: 'hold-1', vueloId: 'seg-1', seatNumber: '12A' }]);
    expect(builder.orIgnore).toHaveBeenCalled();
  });

  it('does nothing without seats', async () => {
    await claimHoldSeats(manager, 'hold-1', []);
    expect(mock.query).not.toHaveBeenCalled();
    expect(mock.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('answers 409 SEAT_TAKEN naming the seat when it is sold', async () => {
    sold = [{ vueloId: 'seg-1', seatNumber: '12A' }];
    const error = (await claimHoldSeats(manager, 'hold-1', [SEAT]).catch((e: unknown) => e)) as ProblemDetailsException;
    expect(error.v2?.detail).toBe('El asiento 12A del segmento seg-1 ya fue tomado.');
    expect(mock.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('answers 409 SEAT_TAKEN when another active hold has the seat', async () => {
    rows = [{ id: 'row-1', holdId: 'hold-2', vueloId: 'seg-1', seatNumber: '12A' }];
    holds = [{ holdId: 'hold-2', status: 'HELD', expiresAt: new Date(Date.now() + 60_000) }];
    expect(await codeOf(claimHoldSeats(manager, 'hold-1', [SEAT]))).toBe('SEAT_TAKEN');
    expect(mock.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('takes over a seat left by a hold that ran out and was not swept yet', async () => {
    rows = [{ id: 'row-1', holdId: 'hold-2', vueloId: 'seg-1', seatNumber: '12A' }];
    holds = [{ holdId: 'hold-2', status: 'HELD', expiresAt: new Date(Date.now() - 1_000) }];
    await claimHoldSeats(manager, 'hold-1', [SEAT]);
    expect(mock.delete).toHaveBeenCalledWith(FlightHoldSeat, expect.objectContaining({ id: expect.anything() }));
    expect(inserted).toHaveLength(1);
  });

  it('answers 409 SEAT_TAKEN when the insert loses the race for the unique index (nothing inserted)', async () => {
    returned = [];
    expect(await codeOf(claimHoldSeats(manager, 'hold-1', [SEAT]))).toBe('SEAT_TAKEN');
  });

  it("ignores the hold's own seats and the seats of holds that are no longer active", async () => {
    rows = [
      { id: 'row-1', holdId: 'mine', vueloId: 'seg-1', seatNumber: '12A' },
      { id: 'row-2', holdId: 'released', vueloId: 'seg-1', seatNumber: '12B' },
    ];
    holds = [{ holdId: 'released', status: 'RELEASED', expiresAt: new Date(Date.now() + 60_000) }];
    expect(await seatHeldByAnotherHold(manager, [SEAT, { segmentId: 'seg-1', seatNumber: '12B' }], 'mine')).toBeNull();

    holds = [{ holdId: 'released', status: 'HELD', expiresAt: new Date(Date.now() + 60_000) }];
    expect(await seatHeldByAnotherHold(manager, [SEAT, { segmentId: 'seg-1', seatNumber: '12B' }], 'mine')).toEqual({ segmentId: 'seg-1', seatNumber: '12B' });
  });

  it('locks each seat once, in a fixed order', async () => {
    await lockSeats(manager, [{ segmentId: 'b', seatNumber: '1A' }, { segmentId: 'a', seatNumber: '2B' }, { segmentId: 'b', seatNumber: '1A' }]);
    expect(mock.query.mock.calls.map((call) => (call as unknown as [string, string[]])[1][0])).toEqual(['vuelos-seat:a:2B', 'vuelos-seat:b:1A']);
  });
});
