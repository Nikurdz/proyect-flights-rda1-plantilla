import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IdempotencyRecord } from '../entities/idempotency-record.entity';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  const repo = {
    findOne: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        { provide: getRepositoryToken(IdempotencyRecord), useValue: repo },
      ],
    }).compile();

    service = module.get(IdempotencyService);
  });

  it('returns undefined when no record exists for the key/route', async () => {
    repo.findOne.mockResolvedValue(null);
    const result = await service.findReplay('key-1', 'POST /offers/hold');
    expect(result).toBeUndefined();
  });

  it('returns the stored response body when a record exists', async () => {
    repo.findOne.mockResolvedValue({ responseBody: { holdId: 'abc' }, responseStatus: 201 });
    const result = await service.findReplay<{ holdId: string }>('key-1', 'POST /offers/hold');
    expect(result).toEqual({ holdId: 'abc' });
  });

  it('records a response keyed by idempotencyKey and route', async () => {
    await service.record('key-1', 'POST /bookings', 201, { bookingId: 'xyz' });
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'key-1',
        route: 'POST /bookings',
        responseStatus: 201,
        responseBody: { bookingId: 'xyz' },
      }),
    );
  });
});
