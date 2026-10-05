import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { assertChronology, assertGroupSize, assertInfantRatio, assertOriginDestinationDiffer } from '../common/business-rules';
import { toIso, utcDayRange } from '../common/date.util';
import { formatMinorUnits, toMinorUnits } from '../common/money.util';
import {
  PASSENGER_TYPES,
  PassengerBreakdown,
  countFor,
  priceForParty,
  priceForPassengerType,
  seatsRequired,
} from '../common/pricing.util';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { VUELOS_CONFIG, VuelosConfig } from '../common/vuelos-config';
import { FareFamily } from '../entities/fare-family.entity';
import { FlightOffer } from '../entities/flight-offer.entity';
import { Vuelo } from '../entities/vuelo.entity';
import type {
  CabinPricingDto,
  FlightOfferDto,
  FlightSegmentDto,
  ItineraryOptionDto,
  SearchRequestDto,
  SearchResponseDto,
} from '../dto/search.dto';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Vuelo) private readonly vuelos: Repository<Vuelo>,
    @InjectRepository(FareFamily) private readonly fareFamilies: Repository<FareFamily>,
    @InjectRepository(FlightOffer) private readonly offers: Repository<FlightOffer>,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
  ) {}

  async search(request: SearchRequestDto): Promise<SearchResponseDto> {
    for (const leg of request.itineraries) {
      assertOriginDestinationDiffer(leg);
    }
    assertChronology(request.itineraries);
    const passengers = this.normalizeBreakdown(request.passengers);
    assertInfantRatio(passengers);
    assertGroupSize(passengers, this.config.maxPassengersPerOrder);

    const families = await this.requireFareFamilies();
    const seats = seatsRequired(passengers);

    const legOptions: Vuelo[][] = [];
    for (const leg of request.itineraries) {
      const matches = await this.findDirectFlights(leg.origin, leg.destination, leg.departureDate, seats);
      if (matches.length === 0) {
        // RF-031: a differentiated empty result, not an error.
        return { totalOffers: 0, offers: [] };
      }
      legOptions.push(matches);
    }

    // Cheapest bundles first, then cap: a truncated list must still hold the best offers.
    const bundles = this.buildCombinations(legOptions)
      .map((combo) => ({
        combo,
        total: combo.reduce((sum, vuelo) => sum + this.cheapestPartyTotal(vuelo, families, passengers), 0),
      }))
      .sort((a, b) => a.total - b.total)
      .slice(0, this.config.maxOfferCombinations);

    const { currency, offerTtlMinutes } = this.config;
    const offerDtos: FlightOfferDto[] = [];

    for (const { combo, total } of bundles) {
      const itineraries: ItineraryOptionDto[] = combo.map((vuelo) => ({
        itineraryId: randomUUID(),
        totalDurationMinutes: vuelo.durationMinutes,
        stopsCount: 0,
        segments: [this.toSegment(vuelo)],
        pricingOptions: this.buildPricingOptions(vuelo, families, passengers),
      }));

      const offerId = randomUUID();
      const grandTotal = formatMinorUnits(total);
      await this.offers.save(
        this.offers.create({
          offerId,
          itineraries: itineraries.map((itinerary, index) => ({ itineraryId: itinerary.itineraryId, vueloId: combo[index].id })),
          grandTotal,
          currency,
          passengersBreakdown: passengers,
          expiresAt: new Date(Date.now() + offerTtlMinutes * 60_000),
        }),
      );

      offerDtos.push({
        offerId,
        airline: { code: combo[0].codigoAerolinea, name: combo[0].aerolinea },
        itineraries,
        grandTotal: { currency, total: grandTotal },
      });
    }

    return { totalOffers: offerDtos.length, offers: offerDtos };
  }

  /**
   * Persists an offer for flights the caller already chose (the e-commerce flow selects by
   * itinerary, not through /search), inside the caller's transaction. Same pricing as /search.
   */
  async createOfferWithin(manager: EntityManager, flights: Vuelo[], passengers: PassengerBreakdown): Promise<FlightOffer> {
    const families = await this.requireFareFamilies();
    const total = flights.reduce((sum, vuelo) => sum + this.cheapestPartyTotal(vuelo, families, passengers), 0);

    return manager.save(
      manager.create(FlightOffer, {
        itineraries: flights.map((vuelo) => ({ itineraryId: randomUUID(), vueloId: vuelo.id })),
        grandTotal: formatMinorUnits(total),
        currency: this.config.currency,
        passengersBreakdown: passengers,
        expiresAt: new Date(Date.now() + this.config.offerTtlMinutes * 60_000),
      }),
    );
  }

  /** Direct flights on one calendar day (UTC) that have not departed and can seat the whole party. */
  async findDirectFlights(origin: string, destination: string, departureDate: string, seatsNeeded: number): Promise<Vuelo[]> {
    const { start, end } = utcDayRange(departureDate);
    return this.vuelos
      .createQueryBuilder('v')
      .where('v."origenIATA" = :origin AND v."destinoIATA" = :destination', { origin, destination })
      .andWhere('v."fechaSalida" >= :start AND v."fechaSalida" < :end', { start, end })
      .andWhere('v."fechaSalida" > :now', { now: new Date() })
      .andWhere('v."asientosDisponibles" >= :seatsNeeded', { seatsNeeded })
      .orderBy('v."fechaSalida"', 'ASC')
      .getMany();
  }

  async requireFareFamilies(): Promise<FareFamily[]> {
    const families = await this.fareFamilies.find();
    if (families.length === 0) {
      throw new ProblemDetailsException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'SERVICE_UNAVAILABLE',
        'Pricing unavailable',
        'No fare families are configured, so no price can be quoted. Run the seed (npm run seed:vuelos).',
      );
    }
    return families;
  }

  normalizeBreakdown(input: Partial<PassengerBreakdown>): PassengerBreakdown {
    return {
      adults: input.adults ?? 1,
      youths: input.youths ?? 0,
      children: input.children ?? 0,
      infants: input.infants ?? 0,
    };
  }

  /** One pricing option per fare family, with a unit price for every passenger type present. */
  buildPricingOptions(vuelo: Vuelo, families: FareFamily[], passengers: PassengerBreakdown): CabinPricingDto[] {
    const baseMinor = toMinorUnits(vuelo.precioBase);
    const { currency, taxRate } = this.config;

    return families.map((family) => ({
      cabinClass: 'ECONOMY',
      fareBrand: family.code,
      availableSeats: vuelo.asientosDisponibles,
      fareRules: { isRefundable: family.refundable, isChangeable: family.changeable },
      baggageAllowance: {
        personalItemIncluded: true,
        carryOnIncluded: family.carryOnKg > 0 ? 1 : 0,
        checkedBaggageIncluded: family.checkedBags,
      },
      pricePerPassengerType: PASSENGER_TYPES.filter((type) => countFor(passengers, type) > 0).map((type) => {
        const price = priceForPassengerType(baseMinor, family.priceMultiplier, type, taxRate);
        return {
          passengerType: type,
          price: {
            currency,
            baseFare: formatMinorUnits(price.baseFare),
            taxes: formatMinorUnits(price.taxes),
            total: formatMinorUnits(price.total),
          },
        };
      }),
    }));
  }

  cheapestPartyTotal(vuelo: Vuelo, families: FareFamily[], passengers: PassengerBreakdown): number {
    const baseMinor = toMinorUnits(vuelo.precioBase);
    return Math.min(...families.map((family) => priceForParty(baseMinor, family.priceMultiplier, passengers, this.config.taxRate)));
  }

  private buildCombinations(legOptions: Vuelo[][]): Vuelo[][] {
    return legOptions.reduce<Vuelo[][]>(
      (acc, options) => acc.flatMap((combo) => options.map((option) => [...combo, option])),
      [[]],
    );
  }

  toSegment(vuelo: Vuelo): FlightSegmentDto {
    return {
      segmentId: vuelo.id,
      flightNumber: vuelo.codigoVuelo,
      departure: { iataCode: vuelo.origenIATA, at: toIso(vuelo.fechaSalida), terminal: null },
      arrival: { iataCode: vuelo.destinoIATA, at: toIso(vuelo.fechaLlegada), terminal: null },
      marketingCarrier: vuelo.codigoAerolinea,
      operatingCarrier: vuelo.codigoAerolinea,
      aircraft: null,
      durationMinutes: vuelo.durationMinutes,
      status: 'SCHEDULED',
    };
  }
}
