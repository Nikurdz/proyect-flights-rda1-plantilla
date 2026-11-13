import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { FlightHoldSeat } from '../entities/flight-hold-seat.entity';
import { Vuelo } from '../entities/vuelo.entity';
import { seedFlights } from '../seed/flights.seed';
import { PartnerAuthService } from '../v2/auth/partner-auth.service';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(180_000);

const V2 = '/api/v2/vuelos';
const dayAhead = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const CLIENT = 'booking-rehold';
const SECRET = 'a-partner-secret-of-24-chars!';

/**
 * Re-doing a hold of the same purchase: the owner's active hold of the SAME offer that has set aside the requested
 * seats is released atomically; a seat of anyone else (other owner, other offer) still answers 409 SEAT_TAKEN.
 */
describeIntegration('Re-holding seats of the same purchase (assignedSeats)', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  let ds: DataSource;
  let token: string;
  let day = 20;

  const api = () => request(app.getHttpServer());
  const bearer = (userId: string) => ({ Authorization: `Bearer ${token}`, 'X-User-Id': userId });

  async function searchOffer(date: string) {
    const res = await api()
      .post(`${V2}/search`)
      .set('X-Device-Fingerprint', 'it-device')
      .send({ itineraries: [{ origin: 'BOG', destination: 'SCL', departureDate: date }], passengers: { adults: 1 } })
      .expect(200);
    const offer = res.body.offers[0] as { offerId: string; itineraries: { itineraryId: string }[] };
    const segmentId = (await api().get(`${V2}/offers/${offer.offerId}/seatmap`).expect(200)).body.segmentId as string;
    return { offer, segmentId };
  }

  /** A hold on `offer` that sets `seatNumbers` aside (one adult per seat). */
  function holdOn(ctxOffer: { offer: { offerId: string; itineraries: { itineraryId: string }[] }; segmentId: string }, userId: string, seatNumbers: string[], key: string = randomUUID(), extra: Record<string, unknown> = {}) {
    const body = {
      offerId: ctxOffer.offer.offerId,
      itinerarySelections: ctxOffer.offer.itineraries.map((i) => ({ itineraryId: i.itineraryId, cabinClass: 'ECONOMY', fareBrand: 'FULL' })),
      passengersBreakdown: { adults: Math.max(1, seatNumbers.length) },
      assignedSeats: seatNumbers.map((seatNumber) => ({ segmentId: ctxOffer.segmentId, seatNumber })),
      ...extra,
    };
    return api().post(`${V2}/offers/hold`).set(bearer(userId)).set('Idempotency-Key', key).send(body);
  }

  const freeSeats = (segmentId: string) => ds.getRepository(Vuelo).findOneByOrFail({ id: segmentId }).then((v) => v.asientosDisponibles);
  const heldRows = (segmentId: string, seatNumber: string) => ds.getRepository(FlightHoldSeat).count({ where: { vueloId: segmentId, seatNumber } });
  const statusOf = async (userId: string, holdId: string) => (await api().get(`${V2}/offers/hold/${holdId}`).set(bearer(userId)).expect(200)).body.status as string;
  const releasedEvents = async (holdId: string) => {
    // hold.released is not part of the partner feed (/eventos), so it is read from the audit trail of every domain event.
    const rows: { n: string }[] = await ds.query(`SELECT count(*) AS n FROM "${ctx.schema}"."auditoria_transacciones" WHERE "agregadoId" = $1 AND "tipo" = 'hold.released'`, [holdId]);
    return Number(rows[0].n);
  };
  async function seatStatus(offerId: string, segmentId: string, seatNumber: string): Promise<string> {
    const map = await api().get(`${V2}/offers/${offerId}/seatmap`).query({ segmentId }).expect(200);
    return (map.body.cabins[0].rows.flatMap((r: { seats: { seatNumber: string; status: string }[] }) => r.seats) as { seatNumber: string; status: string }[]).find((s) => s.seatNumber === seatNumber)!.status;
  }

  beforeAll(async () => {
    ctx = await createIntegrationApp();
    app = ctx.app;
    ds = ctx.dataSource;
    await seedFlights(ds);
    await app.get(PartnerAuthService).upsert(CLIENT, SECRET);
    const res = await api().post('/api/v2/oauth2/token').type('form').send({ grant_type: 'client_credentials', client_id: CLIENT, client_secret: SECRET }).expect(200);
    token = res.body.access_token as string;
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('same owner and same offer: the new hold takes the seat, the old one is RELEASED with its seats and inventory given back, and hold.released is announced once', async () => {
    const o = await searchOffer(dayAhead(day++));
    const initial = await freeSeats(o.segmentId);

    const a = await holdOn(o, 'rh-u1', ['12A']);
    expect(a.status).toBe(201);
    expect(await freeSeats(o.segmentId)).toBe(initial - 1);

    const key = randomUUID();
    const b = await holdOn(o, 'rh-u1', ['12A', '12B'], key);
    expect(b.status).toBe(201);
    expect(b.body.holdId).not.toBe(a.body.holdId);

    expect(await statusOf('rh-u1', a.body.holdId)).toBe('RELEASED');
    expect(await statusOf('rh-u1', b.body.holdId)).toBe('HELD');
    // Net inventory: only the new hold's two passengers, not both holds.
    expect(await freeSeats(o.segmentId)).toBe(initial - 2);
    expect(await heldRows(o.segmentId, '12A')).toBe(1);
    expect(await seatStatus(o.offer.offerId, o.segmentId, '12A')).toBe('HELD');
    expect(await seatStatus(o.offer.offerId, o.segmentId, '12B')).toBe('HELD');
    expect(await releasedEvents(a.body.holdId)).toBe(1);

    // A replay of the same request answers the same and releases/announces nothing more.
    const replay = await holdOn(o, 'rh-u1', ['12A', '12B'], key);
    expect(replay.status).toBe(200); // a replay answers 200 with the stored body
    expect(replay.body.holdId).toBe(b.body.holdId);
    expect(await freeSeats(o.segmentId)).toBe(initial - 2);
    expect(await releasedEvents(a.body.holdId)).toBe(1);
    expect(await releasedEvents(b.body.holdId)).toBe(0);
    expect(await statusOf('rh-u1', b.body.holdId)).toBe('HELD');
  });

  it('another user asking for the seat still gets 409 SEAT_TAKEN and the hold stays HELD', async () => {
    const o = await searchOffer(dayAhead(day++));
    const a = await holdOn(o, 'rh-owner', ['14A']);
    expect(a.status).toBe(201);
    const initial = await freeSeats(o.segmentId);

    const other = await holdOn(o, 'rh-other', ['14A']);
    expect(other.status).toBe(409);
    expect(other.body.code).toBe('SEAT_TAKEN');
    expect(await statusOf('rh-owner', a.body.holdId)).toBe('HELD');
    expect(await heldRows(o.segmentId, '14A')).toBe(1);
    expect(await freeSeats(o.segmentId)).toBe(initial);
    expect(await releasedEvents(a.body.holdId)).toBe(0);
  });

  it('same user but another offer (a new search) is refused with 409 and the hold stays HELD', async () => {
    const date = dayAhead(day++);
    const first = await searchOffer(date);
    const a = await holdOn(first, 'rh-u3', ['15A']);
    expect(a.status).toBe(201);

    const second = await searchOffer(date);
    expect(second.offer.offerId).not.toBe(first.offer.offerId);
    expect(second.segmentId).toBe(first.segmentId);
    const initial = await freeSeats(first.segmentId);
    const b = await holdOn(second, 'rh-u3', ['15A']);
    expect(b.status).toBe(409);
    expect(b.body.code).toBe('SEAT_TAKEN');
    expect(await statusOf('rh-u3', a.body.holdId)).toBe('HELD');
    expect(await freeSeats(first.segmentId)).toBe(initial);
    expect(await releasedEvents(a.body.holdId)).toBe(0);
  });

  it('a failure after the release rolls everything back: the previous hold keeps its seat and inventory', async () => {
    const o = await searchOffer(dayAhead(day++));
    const a = await holdOn(o, 'rh-u4', ['16A']);
    expect(a.status).toBe(201);
    const blocker = await holdOn(o, 'rh-blocker', ['16B']); // another owner's seat
    expect(blocker.status).toBe(201);
    const initial = await freeSeats(o.segmentId);

    const b = await holdOn(o, 'rh-u4', ['16A', '16B']);
    expect(b.status).toBe(409);
    expect(b.body.code).toBe('SEAT_TAKEN');
    expect(await statusOf('rh-u4', a.body.holdId)).toBe('HELD');
    expect(await heldRows(o.segmentId, '16A')).toBe(1);
    expect(await freeSeats(o.segmentId)).toBe(initial);
    expect(await releasedEvents(a.body.holdId)).toBe(0);

    // A too-large party (more passengers than the seats it names) fails before anything is touched.
    const tooMany = await holdOn(o, 'rh-u4', ['16A', '16C'], randomUUID(), { passengersBreakdown: { adults: 1 } });
    expect(tooMany.status).toBe(422);
    expect(await statusOf('rh-u4', a.body.holdId)).toBe('HELD');
    expect(await freeSeats(o.segmentId)).toBe(initial);
  });

  it('a hold that ran out (not swept yet) hands its seat over as before, without announcing a release', async () => {
    const o = await searchOffer(dayAhead(day++));
    const a = await holdOn(o, 'rh-u5', ['17A']);
    expect(a.status).toBe(201);
    await ds.query(`UPDATE "${ctx.schema}"."vuelos_flight_holds" SET "expiresAt" = $1 WHERE "holdId" = $2`, [new Date(Date.now() - 60_000), a.body.holdId]);

    const b = await holdOn(o, 'rh-u5', ['17A']);
    expect(b.status).toBe(201);
    expect(await seatStatus(o.offer.offerId, o.segmentId, '17A')).toBe('HELD');
    expect(await releasedEvents(a.body.holdId)).toBe(0);
  });

  it('a plain hold (no assignedSeats) releases nothing', async () => {
    const o = await searchOffer(dayAhead(day++));
    const a = await holdOn(o, 'rh-u6', ['18A']);
    expect(a.status).toBe(201);
    const plain = await holdOn(o, 'rh-u6', []);
    expect(plain.status).toBe(201);
    expect(await statusOf('rh-u6', a.body.holdId)).toBe('HELD');
    expect(await heldRows(o.segmentId, '18A')).toBe(1);
  });
});
