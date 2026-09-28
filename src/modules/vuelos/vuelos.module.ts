import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '../../common/common.module';
import { VuelosController } from './vuelos.controller';
import { Booking } from './entities/booking.entity';
import { FareFamily } from './entities/fare-family.entity';
import { FlightHold } from './entities/flight-hold.entity';
import { FlightOffer } from './entities/flight-offer.entity';
import { IdempotencyRecord } from './entities/idempotency-record.entity';
import { Passenger } from './entities/passenger.entity';
import { Ticket } from './entities/ticket.entity';
import { Vuelo } from './entities/vuelo.entity';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { BookingsService } from './services/bookings.service';
import { FlightStatusService } from './services/flight-status.service';
import { IdempotencyService } from './services/idempotency.service';
import { OffersService } from './services/offers.service';
import { SearchService } from './services/search.service';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([
      Vuelo,
      FareFamily,
      FlightOffer,
      FlightHold,
      Booking,
      Passenger,
      Ticket,
      IdempotencyRecord,
      WebhookSubscription,
    ]),
  ],
  controllers: [VuelosController],
  providers: [SearchService, OffersService, BookingsService, FlightStatusService, IdempotencyService],
})
export class VuelosModule {}
