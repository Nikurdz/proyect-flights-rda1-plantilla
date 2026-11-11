import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Booking } from './booking.entity';

/** One line of the history shown as BookingDetail.changes (date changes, flight reschedules, cancellation). */
@Entity('vuelos_booking_cambios')
@Index('IDX_booking_cambio_booking', ['bookingId', 'cambiadoEn'])
export class BookingCambio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  bookingId: string;

  @ManyToOne(() => Booking, (booking) => booking.cambios, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookingId' })
  booking?: Booking;

  @Column({ type: 'timestamptz', precision: 3 })
  cambiadoEn: Date;

  @Column({ type: 'varchar', length: 500 })
  descripcion: string;
}
