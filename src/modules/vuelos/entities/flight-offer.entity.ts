import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { bigintNumber } from '../common/bigint.transformer';
import type { PassengerBreakdown } from '../common/pricing.util';
import { FlightOfferItinerary } from './flight-offer-itinerary.entity';

// A cached /search result. The contract has no GET /offers/{offerId}, so seatmap and
// hold both resolve an offerId against this table instead of an in-memory cache.
// `itineraries` maps each contract-facing itineraryId back to the Vuelo row it was
// built from, since a hold/booking must resolve a specific fareBrand per itinerary.
@Entity('vuelos_flight_offers')
export class FlightOffer {
  @PrimaryGeneratedColumn('uuid')
  offerId: string;

  // Load with `relations: { itineraries: true }`; ordered by `orden` (0 = outbound).
  @OneToMany(() => FlightOfferItinerary, (itinerary) => itinerary.offer, { cascade: true })
  itineraries: FlightOfferItinerary[];

  @Column({ type: 'bigint', transformer: bigintNumber })
  grandTotalMinor: number;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ type: 'int' })
  adults: number;

  @Column({ type: 'int', default: 0 })
  youths: number;

  @Column({ type: 'int', default: 0 })
  children: number;

  @Column({ type: 'int', default: 0 })
  infants: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  get passengersBreakdown(): PassengerBreakdown {
    return { adults: this.adults, youths: this.youths, children: this.children, infants: this.infants };
  }
}
