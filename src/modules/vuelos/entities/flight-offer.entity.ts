import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// A cached /search result. The contract has no GET /offers/{offerId}, so seatmap and
// hold both resolve an offerId against this table instead of an in-memory cache.
// `itineraries` maps each contract-facing itineraryId back to the Vuelo row it was
// built from, since a hold/booking must resolve a specific fareBrand per itinerary.
@Entity('vuelos_flight_offers')
export class FlightOffer {
  @PrimaryGeneratedColumn('uuid')
  offerId: string;

  @Column({ type: 'jsonb' })
  itineraries: { itineraryId: string; vueloId: string }[];

  @Column({ type: 'varchar', length: 20 })
  grandTotal: string;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ type: 'jsonb' })
  passengersBreakdown: {
    adults: number;
    youths: number;
    children: number;
    infants: number;
  };

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Column({ type: 'timestamp' })
  expiresAt: Date;
}
