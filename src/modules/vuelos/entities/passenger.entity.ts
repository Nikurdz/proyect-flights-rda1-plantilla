import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type PassengerType = 'ADULT' | 'YOUTH' | 'CHILD' | 'INFANT';

@Entity('vuelos_passengers')
export class Passenger {
  @PrimaryGeneratedColumn('uuid')
  passengerId: string;

  @Column({ type: 'uuid' })
  bookingId: string;

  @Column({ type: 'varchar', length: 10 })
  passengerType: PassengerType;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 20 })
  documentType: string;

  @Column({ type: 'varchar', length: 50 })
  documentNumber: string;

  @Column({ type: 'varchar', length: 2 })
  nationality: string;

  @Column({ type: 'date' })
  birthDate: string;

  @Column({ type: 'varchar', length: 1 })
  gender: string;

  @Column({ type: 'varchar', length: 150 })
  contactEmail: string;

  @Column({ type: 'varchar', length: 30 })
  contactPhone: string;
}
