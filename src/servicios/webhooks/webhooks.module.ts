import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent } from '../../modules/vuelos/entities/outbox-event.entity';
import { OutboxV2Service } from '../../modules/vuelos/v2/outbox-v2.service';
import { crearHealthController } from '../comun/health.controller';
import { infraSatelite, SateliteBaseModule } from '../comun/satelite';

/**
 * The webhook service: queues the deliveries of each event (`WebhooksService`, from the core module), sends them every 15 s
 * (`WebhookDispatcherService`) and keeps the `vuelos_outbox` feed (`OutboxV2Service`). Reading `/eventos` stays in the core.
 */
@Module({
  imports: [SateliteBaseModule, TypeOrmModule.forFeature([OutboxEvent])],
  providers: [OutboxV2Service],
  controllers: [crearHealthController('webhooks')],
})
export class WebhooksServicioModule {}

/** Root module of the process (`dist/servicios/webhooks/main.js`). */
@Module({ imports: [...infraSatelite(), WebhooksServicioModule] })
export class WebhooksModule {}
