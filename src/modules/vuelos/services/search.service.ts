import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Raw, Repository } from 'typeorm';
import {
  assertChronology,
  assertInfantRatio,
  assertOriginDestinationDiffer,
} from '../common/business-rules';
import { computeFarePrice } from '../common/pricing.util';
import { FareFamily } from '../entities/fare-family.entity';
import { FlightOffer } from '../entities/flight-offer.entity';
import { Vuelo } from '../entities/vuelo.entity';
import type {
  CabinPricingDto,
  FlightOfferDto,
  FlightSegmentDto,
  ItineraryOptionDto,
  SearchResponseDto,
} from '../dto/search.dto';
import { SearchRequestDto } from '../dto/search.dto';

// A single offer bundles a small, capped number of leg combinations rather than every
// possible cross product — kept simple since this phase is direct-flights-only anyway.
const MAX_OFFER_COMBINATIONS = 5;

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Vuelo) private readonly vuelos: Repository<Vuelo>,
    @InjectRepository(FareFamily) private readonly fareFamilies: Repository<FareFamily>,
    @InjectRepository(FlightOffer) private readonly offers: Repository<FlightOffer>,
    private readonly config: ConfigService,
  ) {}

  async search(request: SearchRequestDto): Promise<SearchResponseDto> {
    for (const leg of request.itineraries) {
      assertOriginDestinationDiffer(leg);
    }
    assertChronology(request.itineraries);
    const passengers = {
      adults: request.passengers.adults ?? 1,
      youths: request.passengers.youths ?? 0,
      children: request.passengers.children ?? 0,
      infants: request.passengers.infants ?? 0,
    };
    assertInfantRatio(passengers);

    const families = await this.fareFamilies.find();
    const legOptions: Vuelo[][] = [];
    for (const leg of request.itineraries) {
      const matches = await this.findDirectFlights(leg.origin, leg.destination, leg.departureDate);
      if (matches.length === 0) {
        // RF-031: a differentiated empty result, not an error.
        return { totalOffers: 0, offers: [] };
      }
      legOptions.push(matches);
    }

    const combinations = this.buildCombinations(legOptions).slice(0, MAX_OFFER_COMBINATIONS);
    const currency = this.config.get<string>('DEFAULT_CURRENCY', 'USD');
    const taxRate = Number(this.config.get<string>('TAX_RATE', '0.15'));
    const ttlMinutes = Number(this.config.get<string>('OFFER_TTL_MINUTES', '15'));

    const offerDtos: FlightOfferDto[] = [];
    for (const combo of combinations) {
      const itineraries: ItineraryOptionDto[] = [];
      const offerItineraryRefs: { itineraryId: string; vueloId: string }[] = [];
      let cheapestSum = 0;

      for (const vuelo of combo) {
        const itineraryId = randomUUID();
        offerItineraryRefs.push({ itineraryId, vueloId: vuelo.id });

        const pricingOptions = families.map((family) =>
          this.priceFamily(vuelo, family, currency, taxRate),
        );
        const cheapest = Math.min(
          ...pricingOptions.map((p) => Number(p.pricePerPassengerType[0].price.total)),
        );
        cheapestSum += cheapest;

        itineraries.push({
          itineraryId,
          totalDurationMinutes: vuelo.durationMinutes,
          stopsCount: 0,
          segments: [this.toSegment(vuelo)],
          pricingOptions,
        });
      }

      const offerId = randomUUID();
      const grandTotalStr = cheapestSum.toFixed(2);

      await this.offers.save(
        this.offers.create({
          offerId,
          itineraries: offerItineraryRefs,
          grandTotal: grandTotalStr,
          currency,
          passengersBreakdown: passengers,
          expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
        }),
      );

      offerDtos.push({
        offerId,
        airline: { code: combo[0].codigoAerolinea, name: combo[0].aerolinea },
        itineraries,
        grandTotal: { currency, total: grandTotalStr },
      });
    }

    return { totalOffers: offerDtos.length, offers: offerDtos };
  }

  private async findDirectFlights(
    origin: string,
    destination: string,
    departureDate: string,
  ): Promise<Vuelo[]> {
    // Comparing calendar dates as plain strings (DATE(...) truncates the timestamp
    // column) avoids any JS Date/timezone conversion entirely — a Between() on
    // Date-derived ISO strings was silently shifting the window by the local UTC
    // offset and matching nothing.
    return this.vuelos.find({
      where: {
        origenIATA: origin,
        destinoIATA: destination,
        fechaSalida: Raw((alias) => `DATE(${alias}) = :departureDate`, { departureDate }),
      },
    });
  }

  private buildCombinations(legOptions: Vuelo[][]): Vuelo[][] {
    return legOptions.reduce<Vuelo[][]>(
      (acc, options) => acc.flatMap((combo) => options.map((option) => [...combo, option])),
      [[]],
    );
  }

  private priceFamily(
    vuelo: Vuelo,
    family: FareFamily,
    currency: string,
    taxRate: number,
  ): CabinPricingDto {
    const { baseFare, taxes, total } = computeFarePrice(
      vuelo.precioBase,
      family.priceMultiplier,
      taxRate,
    );

    return {
      cabinClass: 'ECONOMY',
      fareBrand: family.code,
      availableSeats: vuelo.asientosDisponibles,
      fareRules: { isRefundable: family.refundable, isChangeable: family.changeable },
      baggageAllowance: {
        personalItemIncluded: true,
        carryOnIncluded: family.carryOnKg > 0 ? 1 : 0,
        checkedBaggageIncluded: family.checkedBags,
      },
      pricePerPassengerType: [
        {
          passengerType: 'ADULT',
          price: {
            currency,
            baseFare: baseFare.toFixed(2),
            taxes: taxes.toFixed(2),
            total: total.toFixed(2),
          },
        },
      ],
    };
  }

  private toSegment(vuelo: Vuelo): FlightSegmentDto {
    return {
      segmentId: vuelo.id,
      flightNumber: vuelo.codigoVuelo,
      departure: {
        iataCode: vuelo.origenIATA,
        at: new Date(vuelo.fechaSalida).toISOString(),
        terminal: null,
      },
      arrival: {
        iataCode: vuelo.destinoIATA,
        at: new Date(vuelo.fechaLlegada).toISOString(),
        terminal: null,
      },
      marketingCarrier: vuelo.codigoAerolinea,
      operatingCarrier: vuelo.codigoAerolinea,
      aircraft: null,
      durationMinutes: vuelo.durationMinutes,
      status: 'SCHEDULED',
    };
  }
}
