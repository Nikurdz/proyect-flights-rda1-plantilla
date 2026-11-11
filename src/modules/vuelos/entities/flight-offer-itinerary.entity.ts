import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { FlightOffer } from './flight-offer.entity';
import { Vuelo } from './vuelo.entity';

/**
 * One leg of a cached /search offer: the contract-facing `itineraryId` and the Vuelo it was built from. A hold or a
 * booking must resolve a specific fare per itinerary, so the mapping is kept (it used to be a jsonb array).
 */
@Entity('vuelos_flight_offer_itineraries')
@Unique('UQ_offer_itinerary_itinerary', ['itineraryId'])
@Unique('UQ_offer_itinerary_orden', ['offerId', 'orden'])
@Index('IDX_offer_itinerary_vuelo', ['vueloId'])
export class FlightOfferItinerary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  offerId: string;

  @ManyToOne(() => FlightOffer, (offer) => offer.itineraries, { onDelete: 'CASCADE', orphanedRowAction: 'delete' })
  @JoinColumn({ name: 'offerId' })
  offer?: FlightOffer;

  // Position of the leg in the offer (0 = outbound).
  @Column({ type: 'int' })
  orden: number;

  @Column({ type: 'uuid' })
  itineraryId: string;

  // The offer is a cache of a search: if the flight disappears the offer goes with it.
  @Column({ type: 'uuid' })
  vueloId: string;

  @ManyToOne(() => Vuelo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vueloId' })
  vuelo?: Vuelo;
}
