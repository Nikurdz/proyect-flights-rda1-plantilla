import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VUELOS_CONFIG, VuelosConfig } from '../common/vuelos-config';
import { FareFamily } from '../entities/fare-family.entity';
import { FlightOffer } from '../entities/flight-offer.entity';
import { Vuelo } from '../entities/vuelo.entity';
import { SearchService } from './search.service';

const config: VuelosConfig = {
  taxRate: 0.15,
  currency: 'USD',
  offerTtlMinutes: 15,
  holdTtlMinutes: 15,
  maxOfferCombinations: 5,
  maxPassengersPerOrder: 9,
  jwtSecret: 'x'.repeat(32),
  jwtTtlSeconds: 3600,
  dataEncryptionKey: Buffer.alloc(32, 1),
  postSale: { baggagePriceMinor: 4000, baggageMaxPerLeg: 2, cutoffHours: 3, changeFeeMinor: 3000, cancelPenaltyPercent: 10, quoteTtlMinutes: 15, checkInOpensHours: 48, checkInClosesHours: 1 },
  webhooks: { maxPerOwner: 10, allowPrivateHosts: false },
};

const vuelo = (id: string, precioBase: number): Vuelo => ({
  id,
  aerolinea: 'LATAM Airlines',
  codigoAerolinea: 'LA',
  codigoVuelo: `LA${id}`,
  origenIATA: 'BOG',
  destinoIATA: 'SCL',
  fechaSalida: new Date('2027-01-15T08:00:00.000Z'),
  fechaLlegada: new Date('2027-01-15T13:00:00.000Z'),
  precioBase,
  asientosDisponibles: 40,
  capacidadTotal: 180,
  durationMinutes: 300,
  estado: 'SCHEDULED',
});

const family = (code: string, priceMultiplier: number): FareFamily => ({
  code,
  name: code,
  carryOnKg: 0,
  checkedBags: 0,
  changeable: false,
  refundable: false,
  seatSelectionIncluded: false,
  upgradeEligible: false,
  accrualFactor: 1,
  priceMultiplier,
});

describe('SearchService', () => {
  let service: SearchService;
  let flights: Vuelo[];
  let families: FareFamily[];

  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(async () => flights),
  };
  const vuelosRepo = { createQueryBuilder: jest.fn(() => queryBuilder) };
  const fareFamiliesRepo = { find: jest.fn(async () => families) };
  const offersRepo = { create: jest.fn((data) => data), save: jest.fn(async (data) => data) };

  const request = (passengers: Record<string, number>, legs = 1) => ({
    itineraries: Array.from({ length: legs }, (_, i) => ({
      origin: i % 2 === 0 ? 'BOG' : 'SCL',
      destination: i % 2 === 0 ? 'SCL' : 'BOG',
      departureDate: '2027-01-15',
    })),
    passengers: { adults: 1, youths: 0, children: 0, infants: 0, ...passengers },
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    flights = [vuelo('1', 300)];
    families = [family('BASIC', 1)];

    const module = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: getRepositoryToken(Vuelo), useValue: vuelosRepo },
        { provide: getRepositoryToken(FareFamily), useValue: fareFamiliesRepo },
        { provide: getRepositoryToken(FlightOffer), useValue: offersRepo },
        { provide: VUELOS_CONFIG, useValue: config },
      ],
    }).compile();

    service = module.get(SearchService);
  });

  it('prices every passenger type present and totals the whole party (A2)', async () => {
    const result = await service.search(request({ adults: 2, children: 1, infants: 1 }));

    const pricing = result.offers[0].itineraries[0].pricingOptions[0];
    const byType = Object.fromEntries(pricing.pricePerPassengerType.map((p) => [p.passengerType, p.price.total]));
    // base 300: adult 300+15% = 345.00 / child 75% = 258.75 / infant 10% = 34.50
    expect(byType).toEqual({ ADULT: '345.00', CHILD: '258.75', INFANT: '34.50' });
    // 2 adults + 1 child + 1 infant
    expect(result.offers[0].grandTotal.total).toBe('983.25');
    expect(offersRepo.save).toHaveBeenCalledTimes(1);
  });

  it('returns an empty, differentiated result when no flight matches (RF-031)', async () => {
    flights = [];
    expect(await service.search(request({}))).toEqual({ totalOffers: 0, offers: [] });
  });

  it('fails with 503 instead of quoting "Infinity" when no fare families exist', async () => {
    families = [];
    await expect(service.search(request({}))).rejects.toMatchObject({ status: 503 });
  });

  it('keeps the cheapest bundles when the combination cap truncates the list', async () => {
    flights = [vuelo('1', 500), vuelo('2', 100), vuelo('3', 300)];
    const result = await service.search(request({}, 2));

    expect(result.totalOffers).toBe(5); // 3 x 3 = 9 combinations, capped at 5
    const totals = result.offers.map((o) => Number(o.grandTotal.total));
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
    expect(totals[0]).toBe(230); // 2 x (100 + 15%)
  });

  it('rejects a request where origin equals destination (RN-01)', async () => {
    await expect(
      service.search({ itineraries: [{ origin: 'BOG', destination: 'BOG', departureDate: '2027-01-15' }], passengers: { adults: 1 } }),
    ).rejects.toThrow();
  });

  it('rejects more infants than adults (RN-04) and oversized groups (RN-05)', async () => {
    await expect(service.search(request({ adults: 1, infants: 2 }))).rejects.toMatchObject({ status: 422 });
    await expect(service.search(request({ adults: 9, children: 1 }))).rejects.toMatchObject({ status: 422 });
  });

  it('asks the catalog only for flights that can seat the whole party', async () => {
    await service.search(request({ adults: 2, children: 1, infants: 1 }));
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(expect.stringContaining('asientosDisponibles'), { seatsNeeded: 3 });
  });
});
