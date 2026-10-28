import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from '../ecommerce/admin/admin.module';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { PartnerClient } from '../entities/partner-client.entity';
import { PromocionAlcance, PromocionContrato } from '../entities/promocion-contrato.entity';
import { VuelosCoreModule } from '../vuelos-core.module';
import { OAuth2Controller } from './auth/oauth2.controller';
import { PartnerAuthGuard } from './auth/partner-auth.guard';
import { PartnerAuthService } from './auth/partner-auth.service';
import { BookingInboundV2Controller } from './booking-inbound-v2.controller';
import { BookingBootstrapV2Service } from './booking-bootstrap-v2.service';
import { BookingViewV2Service } from './booking-view-v2.service';
import { FlightOpsV2Service } from './flight-ops-v2.service';
import { HealthV2Service } from './health-v2.service';
import { InboundEventsV2Service } from './inbound-events-v2.service';
import { OutboxV2Service } from './outbox-v2.service';
import { PromotionsV2Service } from './promotions-v2.service';
import { SeatChangeV2Service } from './seat-change-v2.service';
import { StockPushService } from './stock-push.service';
import { TicketsV2Service } from './tickets-v2.service';
import { VuelosV2Controller } from './vuelos-v2.controller';

/** Contract v2 (/api/v2/vuelos): the same core services behind OAuth2 partner tokens, CloudEvents and the new operations. */
@Module({
  imports: [VuelosCoreModule, AdminModule, TypeOrmModule.forFeature([PartnerClient, OutboxEvent, PromocionContrato, PromocionAlcance])],
  controllers: [VuelosV2Controller, BookingInboundV2Controller, OAuth2Controller],
  providers: [PartnerAuthService, PartnerAuthGuard, BookingViewV2Service, SeatChangeV2Service, TicketsV2Service, FlightOpsV2Service, OutboxV2Service, PromotionsV2Service, HealthV2Service, InboundEventsV2Service, StockPushService, BookingBootstrapV2Service],
  exports: [PartnerAuthService, PromotionsV2Service, TicketsV2Service, StockPushService],
})
export class VuelosV2Module {}
