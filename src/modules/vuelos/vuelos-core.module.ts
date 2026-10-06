import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { TokenService } from './auth/token.service';
import { FieldCipher } from './common/cifrado';
import { DomainEventBus } from './common/domain-event-bus';
import { VUELOS_CONFIG, VuelosConfig, loadVuelosConfig } from './common/vuelos-config';
import { BaggagePurchase } from './entities/baggage-purchase.entity';
import { Booking } from './entities/booking.entity';
import { CancellationQuote } from './entities/cancellation-quote.entity';
import { CheckIn } from './entities/check-in.entity';
import { DateChangeOffer } from './entities/date-change-offer.entity';
import { FareFamily } from './entities/fare-family.entity';
import { FlightHold } from './entities/flight-hold.entity';
import { FlightOffer } from './entities/flight-offer.entity';
import { IdempotencyRecord } from './entities/idempotency-record.entity';
import { Passenger } from './entities/passenger.entity';
import { SeatAssignment } from './entities/seat-assignment.entity';
import { Ticket } from './entities/ticket.entity';
import { Vuelo } from './entities/vuelo.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { BaggageService } from './services/baggage.service';
import { BookingContextService } from './services/booking-context.service';
import { BookingsService } from './services/bookings.service';
import { CancellationService } from './services/cancellation.service';
import { CheckInService } from './services/check-in.service';
import { DateChangeService } from './services/date-change.service';
import { FlightStatusService } from './services/flight-status.service';
import { HoldsSweeper } from './services/holds-sweeper.service';
import { IdempotencyService } from './services/idempotency.service';
import { InventoryService } from './services/inventory.service';
import { OffersService } from './services/offers.service';
import { SearchService } from './services/search.service';
import { WebhookDispatcherService } from './services/webhook-dispatcher.service';
import { WebhooksService } from './services/webhooks.service';

/**
 * The flight inventory/booking core (the "PSS side"): search, holds, bookings, tickets,
 * idempotency, JWT verification and the domain event bus. It has no HTTP surface of its own;
 * VuelosController exposes the GDS contract, and the e-commerce modules consume these
 * services in-process.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vuelo,
      FareFamily,
      FlightOffer,
      FlightHold,
      Booking,
      Passenger,
      Ticket,
      SeatAssignment,
      IdempotencyRecord,
      BaggagePurchase,
      DateChangeOffer,
      CancellationQuote,
      CheckIn,
      WebhookSubscription,
      WebhookDelivery,
    ]),
  ],
  providers: [
    // Validated once at boot: a bad env var stops the app with a readable message.
    { provide: VUELOS_CONFIG, inject: [ConfigService], useFactory: loadVuelosConfig },
    {
      // Entities encrypt personal data through static transformers, so the key is installed once
      // here; nothing can be written before the module (and its validated config) is up.
      provide: 'FIELD_CIPHER',
      inject: [VUELOS_CONFIG],
      useFactory: (config: VuelosConfig) => {
        FieldCipher.configure(config.dataEncryptionKey);
        return FieldCipher;
      },
    },
    TokenService,
    JwtAuthGuard,
    DomainEventBus,
    IdempotencyService,
    InventoryService,
    SearchService,
    OffersService,
    BookingsService,
    BookingContextService,
    BaggageService,
    DateChangeService,
    CancellationService,
    CheckInService,
    WebhooksService,
    WebhookDispatcherService,
    FlightStatusService,
    HoldsSweeper,
  ],
  exports: [
    TypeOrmModule,
    VUELOS_CONFIG,
    'FIELD_CIPHER',
    TokenService,
    JwtAuthGuard,
    DomainEventBus,
    IdempotencyService,
    InventoryService,
    SearchService,
    OffersService,
    BookingsService,
    BookingContextService,
    BaggageService,
    DateChangeService,
    CancellationService,
    CheckInService,
    WebhooksService,
    WebhookDispatcherService,
    FlightStatusService,
  ],
})
export class VuelosCoreModule {}
