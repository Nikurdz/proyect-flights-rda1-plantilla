import { Module } from '@nestjs/common';
import { ObservabilidadModule } from '../ecommerce/observabilidad/observabilidad.module';
import { VuelosCoreModule } from '../vuelos-core.module';
import { EsbRouter } from './esb-router';
import { RabbitMqTransport } from './rabbitmq.transport';
import { SagaOrchestrator } from './saga-orchestrator';

/** The internal service bus: the saga orchestrator and the router. The layer between the gateway and the domains. */
@Module({
  imports: [VuelosCoreModule, ObservabilidadModule],
  providers: [SagaOrchestrator, RabbitMqTransport, EsbRouter],
  exports: [SagaOrchestrator, RabbitMqTransport, EsbRouter],
})
export class EsbModule {}
