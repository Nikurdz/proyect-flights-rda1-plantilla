import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DomainEventBus } from '../common/domain-event-bus';
import { Booking } from '../entities/booking.entity';
import { FlightHold } from '../entities/flight-hold.entity';
import { Ticket } from '../entities/ticket.entity';
import { Vuelo } from '../entities/vuelo.entity';
import type { BookingRequestDto, PassengerItemDto } from '../dto/booking.dto';
import { BookingsService } from './bookings.service';
import { IdempotencyService } from './idempotency.service';
import { OffersService } from './offers.service';

const OWNER = { ownerId: 'owner-1', kind: 'customer' as const, roles: [] };
const HOLD_ID = '11111111-1111-4111-8111-111111111111';
const VUELO_ID = '22222222-2222-4222-8222-222222222222';

const adult: PassengerItemDto = {
  passengerId: 'p1',
  passengerType: 'ADULT',
  firstName: 'David',
  lastName: 'Tapia',
  documentType: 'PASSPORT',
  documentNumber: 'X1234567',
  nationality: 'EC',
  birthDate: '1995-01-01',
  gender: 'M',
  contact: { email: 'a@b.com', phone: '+593999999999' },
};

describe('BookingsService', () => {
  let service: BookingsService;
  let hold: Partial<FlightHold>;
  let vuelos: Partial<Vuelo>[];
  let paymentAlreadyUsed: boolean;
  let consumeAffected: number;
  let saved: { bookings: unknown[]; seats: unknown[] };

  const manager = {
    findOne: jest.fn(async (entity: unknown) => (entity === FlightHold ? hold : null)),
    find: jest.fn(async (entity: unknown) => (entity === Vuelo ? vuelos : [])),
    exists: jest.fn(async (entity: unknown, options: { where: Record<string, unknown> }) =>
      entity === Booking && 'paymentReference' in options.where ? paymentAlreadyUsed : false,
    ),
    update: jest.fn(async () => ({ affected: consumeAffected })),
    create: jest.fn((_entity: unknown, data: object) => ({ ...data })),
    save: jest.fn(async (input: object | object[]) => {
      if (Array.isArray(input)) {
        const first = input[0] as Record<string, unknown> | undefined;
        if (first && 'seatNumber' in first) saved.seats.push(...input);
        return input.map((row, index) => ({ ...row, passengerId: `pax-${index}`, id: `seat-${index}` }));
      }
      const row = input as Record<string, unknown>;
      if ('pnr' in row) {
        saved.bookings.push(row);
        return { ...row, bookingId: 'booking-1', createdAt: new Date(), updatedAt: new Date() };
      }
      return { ...row, ticketId: `ticket-${String(row.passengerId)}` };
    }),
  };

  const idempotency = {
    execute: jest.fn(async (_scope: unknown, _status: number, work: (m: typeof manager) => Promise<unknown>) => ({
      result: await work(manager),
      replayed: false,
    })),
  };
  const offers = { expireIfDue: jest.fn() };
  const events = { publish: jest.fn() };
  const bookingsRepo = { findOne: jest.fn(), createQueryBuilder: jest.fn() };
  const ticketsRepo = { find: jest.fn() };

  const book = (overrides: Partial<BookingRequestDto> = {}) =>
    service.createBooking(OWNER, 'key-1', {
      holdId: HOLD_ID,
      passengers: [adult],
      payment: { paymentReference: 'pay_0000001' },
      ...overrides,
    });

  beforeEach(async () => {
    jest.clearAllMocks();
    saved = { bookings: [], seats: [] };
    paymentAlreadyUsed = false;
    consumeAffected = 1;
    hold = {
      holdId: HOLD_ID,
      ownerId: 'owner-1',
      status: 'HELD',
      lockedPrice: '345.00',
      currency: 'USD',
      expiresAt: new Date(Date.now() + 60_000),
      inventory: [{ vueloId: VUELO_ID, seats: 1 }],
      passengersBreakdown: { adults: 1, youths: 0, children: 0, infants: 0 },
    };
    vuelos = [
      {
        id: VUELO_ID,
        codigoVuelo: 'LA800',
        origenIATA: 'BOG',
        destinoIATA: 'SCL',
        fechaSalida: new Date('2027-01-15T08:00:00.000Z'),
        fechaLlegada: new Date('2027-01-15T13:00:00.000Z'),
        capacidadTotal: 180,
      },
    ];

    const module = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: getRepositoryToken(Booking), useValue: bookingsRepo },
        { provide: getRepositoryToken(Ticket), useValue: ticketsRepo },
        { provide: OffersService, useValue: offers },
        { provide: IdempotencyService, useValue: idempotency },
        { provide: DomainEventBus, useValue: events },
      ],
    }).compile();

    service = module.get(BookingsService);
  });

  it('confirms the booking, consumes the hold, and issues one ticket per passenger', async () => {
    const result = await book();

    expect(result.status).toBe('CONFIRMED');
    expect(result.pnr).toMatch(/^[A-Z2-9]{6}$/);
    expect(result.grandTotal).toEqual({ currency: 'USD', total: '345.00' });
    expect(result.tickets).toHaveLength(1);
    expect(result.tickets![0].eTicketNumber).toMatch(/^\d{13}$/);
    expect(manager.update).toHaveBeenCalledWith(FlightHold, { holdId: HOLD_ID, status: 'HELD' }, { status: 'CONSUMED' });
    expect(saved.bookings[0]).toMatchObject({ ownerId: 'owner-1', origin: 'BOG', destination: 'SCL' });
    expect(events.publish).toHaveBeenCalledWith('booking.confirmed', 'booking-1', expect.objectContaining({ holdId: HOLD_ID }));
  });

  it('does not publish the domain event again when the response is an idempotent replay', async () => {
    idempotency.execute.mockResolvedValueOnce({
      result: { holdId: HOLD_ID, response: { bookingId: 'cached', pnr: 'AAAAAA', tickets: [] } },
      replayed: true,
    });

    const result = await book();

    expect(result.bookingId).toBe('cached');
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('persists the chosen seats and refuses seats on infants', async () => {
    const withSeat = { ...adult, assignedSeats: [{ segmentId: VUELO_ID, seatNumber: '14C' }] };
    await book({ passengers: [withSeat] });
    expect(saved.seats).toHaveLength(1);

    hold.passengersBreakdown = { adults: 1, youths: 0, children: 0, infants: 1 };
    const infant = {
      ...adult,
      passengerId: 'p2',
      passengerType: 'INFANT',
      firstName: 'Bebe',
      documentNumber: 'X7654321',
      birthDate: '2026-06-01',
      associatedAdultId: 'p1',
      assignedSeats: [{ segmentId: VUELO_ID, seatNumber: '14D' }],
    };
    await expect(book({ passengers: [adult, infant] })).rejects.toMatchObject({ status: 422 });
  });

  it('rejects a hold that was already consumed (409) and one that belongs to someone else (403)', async () => {
    hold.status = 'CONSUMED';
    await expect(book()).rejects.toMatchObject({ status: 409 });

    hold.status = 'HELD';
    hold.ownerId = 'someone-else';
    await expect(book()).rejects.toMatchObject({ status: 403 });
  });

  it('rejects an expired hold with 410 and releases its seats right away', async () => {
    hold.expiresAt = new Date(Date.now() - 1_000);

    await expect(book()).rejects.toMatchObject({ status: 410 });
    expect(offers.expireIfDue).toHaveBeenCalledWith(HOLD_ID);
  });

  it('reports a lost consume race as 409 instead of creating a second booking', async () => {
    consumeAffected = 0;
    await expect(book()).rejects.toMatchObject({ status: 409 });
    expect(saved.bookings).toHaveLength(0);
  });

  it('requires the party to match what was held and priced', async () => {
    await expect(book({ passengers: [adult, { ...adult, passengerId: 'p2', firstName: 'Ana', documentNumber: 'X2222222' }] })).rejects.toMatchObject({ status: 422 });
  });

  it('rejects a passenger whose declared type does not match their age (RN-06)', async () => {
    await expect(book({ passengers: [{ ...adult, birthDate: '2020-01-01' }] })).rejects.toMatchObject({ status: 422 });
  });

  it('rejects duplicate passengers, infants without an adult, and unknown seats', async () => {
    hold.passengersBreakdown = { adults: 2, youths: 0, children: 0, infants: 0 };
    await expect(book({ passengers: [adult, { ...adult, passengerId: 'p2' }] })).rejects.toMatchObject({ status: 422 });

    hold.passengersBreakdown = { adults: 1, youths: 0, children: 0, infants: 1 };
    const orphan = { ...adult, passengerId: 'p2', passengerType: 'INFANT', firstName: 'Bebe', documentNumber: 'X7654321', birthDate: '2026-06-01' };
    await expect(book({ passengers: [adult, orphan] })).rejects.toMatchObject({ status: 422 });

    hold.passengersBreakdown = { adults: 1, youths: 0, children: 0, infants: 0 };
    await expect(book({ passengers: [{ ...adult, assignedSeats: [{ segmentId: VUELO_ID, seatNumber: '99Z' }] }] })).rejects.toMatchObject({ status: 422 });
  });

  it('refuses a paymentReference that already backs another booking', async () => {
    paymentAlreadyUsed = true;
    await expect(book()).rejects.toMatchObject({ status: 409 });
  });

  describe('reads', () => {
    it('answers 404 for an unknown booking and 403 for someone else’s (C1)', async () => {
      bookingsRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.getBookingDetail('owner-1', 'b1')).rejects.toMatchObject({ status: 404 });

      bookingsRepo.findOne.mockResolvedValueOnce({ bookingId: 'b1', ownerId: 'someone-else' });
      await expect(service.getBookingTickets('owner-1', 'b1')).rejects.toMatchObject({ status: 403 });

      bookingsRepo.findOne.mockResolvedValueOnce({ bookingId: 'b1', ownerId: 'someone-else' });
      await expect(service.getTicketDetail('owner-1', 'b1', 't1')).rejects.toMatchObject({ status: 403 });
    });

    it('rejects a malformed pagination cursor with 400', async () => {
      const qb = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis() };
      bookingsRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.listBookings('owner-1', { cursor: 'not-a-cursor' })).rejects.toMatchObject({ status: 400 });
    });
  });
});
