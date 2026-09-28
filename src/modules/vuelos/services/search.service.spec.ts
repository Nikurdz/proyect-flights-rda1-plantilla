import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FareFamily } from '../entities/fare-family.entity';
import { FlightOffer } from '../entities/flight-offer.entity';
import { Vuelo } from '../entities/vuelo.entity';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let service: SearchService;

  const sampleVuelo: Vuelo = {
    id: 'vuelo-1',
    aerolinea: 'LATAM Airlines',
    codigoAerolinea: 'LA',
    codigoVuelo: 'LA800',
    origenIATA: 'BOG',
    destinoIATA: 'SCL',
    fechaSalida: '2027-01-15T08:00:00.000Z',
    fechaLlegada: '2027-01-15T13:00:00.000Z',
    precioBase: 300,
    asientosDisponibles: 40,
    durationMinutes: 300,
  };

  const sampleFamilies: FareFamily[] = [
    {
      code: 'BASIC',
      name: 'Basic',
      carryOnKg: 0,
      checkedBags: 0,
      changeable: false,
      refundable: false,
      seatSelectionIncluded: false,
      upgradeEligible: false,
      accrualFactor: 0.5,
      priceMultiplier: 1,
    },
  ];

  const vuelosRepo = { find: jest.fn() };
  const fareFamiliesRepo = { find: jest.fn() };
  const offersRepo = { create: jest.fn((data) => data), save: jest.fn((data) => data) };
  const configService = { get: jest.fn((_key: string, def?: unknown) => def) };

  beforeEach(async () => {
    jest.clearAllMocks();
    vuelosRepo.find.mockResolvedValue([sampleVuelo]);
    fareFamiliesRepo.find.mockResolvedValue(sampleFamilies);
    configService.get.mockImplementation((_key: string, def?: unknown) => def);

    const module = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: getRepositoryToken(Vuelo), useValue: vuelosRepo },
        { provide: getRepositoryToken(FareFamily), useValue: fareFamiliesRepo },
        { provide: getRepositoryToken(FlightOffer), useValue: offersRepo },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(SearchService);
  });

  it('returns priced offers for a matching direct flight', async () => {
    const result = await service.search({
      itineraries: [{ origin: 'BOG', destination: 'SCL', departureDate: '2027-01-15' }],
      passengers: { adults: 1, youths: 0, children: 0, infants: 0 },
    });

    expect(result.totalOffers).toBe(1);
    const offer = result.offers[0];
    expect(offer.itineraries[0].pricingOptions[0].fareBrand).toBe('BASIC');
    // priceMultiplier 1, default TAX_RATE 0.15 (from search.service's fallback default)
    expect(offer.itineraries[0].pricingOptions[0].pricePerPassengerType[0].price.total).toBe('345.00');
  });

  it('returns an empty, differentiated result when no flight matches (RF-031)', async () => {
    vuelosRepo.find.mockResolvedValue([]);
    const result = await service.search({
      itineraries: [{ origin: 'BOG', destination: 'MIA', departureDate: '2027-01-15' }],
      passengers: { adults: 1, youths: 0, children: 0, infants: 0 },
    });
    expect(result).toEqual({ totalOffers: 0, offers: [] });
  });

  it('rejects a request where origin equals destination (RN-01)', async () => {
    await expect(
      service.search({
        itineraries: [{ origin: 'BOG', destination: 'BOG', departureDate: '2027-01-15' }],
        passengers: { adults: 1, youths: 0, children: 0, infants: 0 },
      }),
    ).rejects.toThrow();
  });

  it('rejects a request with more infants than adults (RN-04)', async () => {
    await expect(
      service.search({
        itineraries: [{ origin: 'BOG', destination: 'SCL', departureDate: '2027-01-15' }],
        passengers: { adults: 1, youths: 0, children: 0, infants: 2 },
      }),
    ).rejects.toThrow();
  });
});
