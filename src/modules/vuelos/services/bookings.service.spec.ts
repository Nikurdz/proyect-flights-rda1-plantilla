import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Booking } from '../entities/booking.entity';
import { FlightHold } from '../entities/flight-hold.entity';
import { FlightOffer } from '../entities/flight-offer.entity';
import { Passenger } from '../entities/passenger.entity';
import { Ticket } from '../entities/ticket.entity';
import { Vuelo } from '../entities/vuelo.entity';
import { BookingsService } from './bookings.service';
import { IdempotencyService } from './idempotency.service';
import { OffersService } from './offers.service';

describe('BookingsService', () => {
  let service: BookingsService;

  const bookingsRepo = { create: jest.fn((d) => d), save: jest.fn((d) => ({ ...d, bookingId: 'booking-1', createdAt: new Date(), updatedAt: new Date() })), findOne: jest.fn() };
  const passengersRepo = { create: jest.fn((d) => d), save: jest.fn((d) => d.map((p: object, i: number) => ({ ...p, passengerId: `passenger-${i}` }))), find: jest.fn() };
  const ticketsRepo = { create: jest.fn((d) => d), save: jest.fn((d) => d), find: jest.fn(), findOne: jest.fn() };
  const offersRepo = { findOne: jest.fn() };
  const vuelosRepo = { find: jest.fn() };
  const offersService = { findHoldOrThrow: jest.fn(), setHoldStatus: jest.fn() };
  const idempotencyService = { findReplay: jest.fn(), record: jest.fn() };

  const heldHold: Partial<FlightHold> = {
    holdId: 'hold-1',
    offerId: 'offer-1',
    status: 'HELD',
    lockedPrice: '400.00',
    currency: 'USD',
    expiresAt: new Date(Date.now() + 60_000),
  };

  const samplePassenger = {
    passengerId: 'p1',
    passengerType: 'ADULT' as const,
    firstName: 'David',
    lastName: 'Tapia',
    documentType: 'PASSPORT',
    documentNumber: 'X1',
    nationality: 'EC',
    birthDate: '1995-01-01',
    gender: 'M',
    contact: { email: 'a@b.com', phone: '+593999999999' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    idempotencyService.findReplay.mockResolvedValue(undefined);
    offersService.findHoldOrThrow.mockResolvedValue({ ...heldHold });
    offersRepo.findOne.mockResolvedValue({
      offerId: 'offer-1',
      itineraries: [{ itineraryId: 'itin-1', vueloId: 'vuelo-1' }],
    });
    vuelosRepo.find.mockResolvedValue([{ id: 'vuelo-1', fechaSalida: '2027-01-15T08:00:00.000Z' }]);
    bookingsRepo.findOne.mockResolvedValue(null);

    const module = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: getRepositoryToken(Booking), useValue: bookingsRepo },
        { provide: getRepositoryToken(Passenger), useValue: passengersRepo },
        { provide: getRepositoryToken(Ticket), useValue: ticketsRepo },
        { provide: getRepositoryToken(FlightOffer), useValue: offersRepo },
        { provide: getRepositoryToken(Vuelo), useValue: vuelosRepo },
        { provide: OffersService, useValue: offersService },
        { provide: IdempotencyService, useValue: idempotencyService },
      ],
    }).compile();

    service = module.get(BookingsService);
  });

  it('creates a confirmed booking with an issued ticket per passenger', async () => {
    const result = await service.createBooking(
      'idem-1',
      { holdId: 'hold-1', passengers: [samplePassenger], payment: { paymentReference: 'pay-1' } } as never,
      undefined,
    );

    expect(result.status).toBe('CONFIRMED');
    expect(result.pnr).toMatch(/^[A-Z0-9]{6}$/);
    expect(result.tickets).toHaveLength(1);
    expect(offersService.setHoldStatus).toHaveBeenCalledWith(expect.anything(), 'CONSUMED');
    expect(idempotencyService.record).toHaveBeenCalled();
  });

  it('replays the cached response for a retried Idempotency-Key without touching the DB', async () => {
    idempotencyService.findReplay.mockResolvedValue({ bookingId: 'cached', pnr: 'AAA111' });

    const result = await service.createBooking(
      'idem-1',
      { holdId: 'hold-1', passengers: [samplePassenger], payment: { paymentReference: 'pay-1' } } as never,
      undefined,
    );

    expect(result).toEqual({ bookingId: 'cached', pnr: 'AAA111' });
    expect(bookingsRepo.save).not.toHaveBeenCalled();
  });

  it('rejects creating a booking from an already-consumed hold (RN-18)', async () => {
    offersService.findHoldOrThrow.mockResolvedValue({ ...heldHold, status: 'CONSUMED' });

    await expect(
      service.createBooking(
        'idem-1',
        { holdId: 'hold-1', passengers: [samplePassenger], payment: { paymentReference: 'pay-1' } } as never,
        undefined,
      ),
    ).rejects.toThrow();
  });

  it('rejects creating a booking from an expired hold', async () => {
    offersService.findHoldOrThrow.mockResolvedValue({
      ...heldHold,
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(
      service.createBooking(
        'idem-1',
        { holdId: 'hold-1', passengers: [samplePassenger], payment: { paymentReference: 'pay-1' } } as never,
        undefined,
      ),
    ).rejects.toThrow();
  });

  it('rejects a passenger whose declared type does not match their age (RN-06)', async () => {
    const child = { ...samplePassenger, passengerType: 'ADULT' as const, birthDate: '2020-01-01' };

    await expect(
      service.createBooking(
        'idem-1',
        { holdId: 'hold-1', passengers: [child], payment: { paymentReference: 'pay-1' } } as never,
        undefined,
      ),
    ).rejects.toThrow();
  });
});
