import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { IdempotencyRecord } from '../entities/idempotency-record.entity';
import { IdempotencyService, hashRequestBody } from './idempotency.service';

describe('hashRequestBody', () => {
  it('ignores key order and undefined values so equivalent bodies hash the same', () => {
    expect(hashRequestBody({ a: 1, b: { c: 2, d: [1, 2] } })).toBe(hashRequestBody({ b: { d: [1, 2], c: 2 }, a: 1, e: undefined }));
  });

  it('distinguishes different bodies', () => {
    expect(hashRequestBody({ a: 1 })).not.toBe(hashRequestBody({ a: 2 }));
    expect(hashRequestBody({ a: [1, 2] })).not.toBe(hashRequestBody({ a: [2, 1] }));
  });
});

describe('IdempotencyService', () => {
  const scope = { key: 'key-1', route: 'POST /bookings', ownerId: 'owner-1', body: { holdId: 'h1' } };
  const identity = { idempotencyKey: 'key-1', route: 'POST /bookings', ownerId: 'owner-1' };

  let service: IdempotencyService;
  let inserted: { raw: unknown[] };
  const insertBuilder = {
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };
  const repo = {
    createQueryBuilder: jest.fn(() => insertBuilder),
    findOne: jest.fn(),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const manager = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
  const dataSource = { transaction: jest.fn(async (fn: (m: typeof manager) => unknown) => fn(manager)) };

  beforeEach(async () => {
    jest.clearAllMocks();
    inserted = { raw: [{ idempotencyKey: 'key-1' }] };
    insertBuilder.execute.mockImplementation(async () => inserted);

    const module = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        { provide: getRepositoryToken(IdempotencyRecord), useValue: repo },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();
    service = module.get(IdempotencyService);
  });

  it('runs the work once and completes the claim inside the same transaction', async () => {
    const work = jest.fn().mockResolvedValue({ bookingId: 'b1' });

    const outcome = await service.execute(scope, 201, work);

    expect(outcome).toEqual({ result: { bookingId: 'b1' }, replayed: false });
    expect(work).toHaveBeenCalledWith(manager);
    expect(manager.update).toHaveBeenCalledWith(
      IdempotencyRecord,
      identity,
      expect.objectContaining({ state: 'COMPLETED', responseStatus: 201, responseBody: { bookingId: 'b1' } }),
    );
  });

  it('replays the stored response of a completed identical request without running the work', async () => {
    inserted = { raw: [] };
    repo.findOne.mockResolvedValue({
      requestHash: hashRequestBody(scope.body),
      state: 'COMPLETED',
      responseBody: { bookingId: 'cached' },
      createdAt: new Date(),
    });
    const work = jest.fn();

    const outcome = await service.execute(scope, 201, work);

    expect(outcome).toEqual({ result: { bookingId: 'cached' }, replayed: true });
    expect(work).not.toHaveBeenCalled();
  });

  it('rejects the same key with a different body (422) instead of replaying another response', async () => {
    inserted = { raw: [] };
    repo.findOne.mockResolvedValue({ requestHash: hashRequestBody({ holdId: 'other' }), state: 'COMPLETED', responseBody: {}, createdAt: new Date() });

    await expect(service.execute(scope, 201, jest.fn())).rejects.toMatchObject({ status: 422 });
  });

  it('answers 409 while an identical request is still in progress', async () => {
    inserted = { raw: [] };
    repo.findOne.mockResolvedValue({ requestHash: hashRequestBody(scope.body), state: 'IN_PROGRESS', createdAt: new Date() });
    const work = jest.fn();

    await expect(service.execute(scope, 201, work)).rejects.toMatchObject({ status: 409 });
    expect(work).not.toHaveBeenCalled();
  });

  it('releases the claim when the work fails so the client can retry the same key', async () => {
    const failure = new Error('boom');

    await expect(service.execute(scope, 201, jest.fn().mockRejectedValue(failure))).rejects.toBe(failure);

    expect(repo.delete).toHaveBeenCalledWith({ ...identity, state: 'IN_PROGRESS' });
  });
});
