import { Module } from '@nestjs/common';
import { EcommerceModule } from './ecommerce/ecommerce.module';
import { VuelosController } from './vuelos.controller';
import { GatewayModule } from './gateway/gateway.module';
import { VuelosCoreModule } from './vuelos-core.module';
import { VuelosV2Module } from './v2/v2.module';

@Module({
  imports: [VuelosCoreModule, EcommerceModule, GatewayModule, VuelosV2Module],
  controllers: [VuelosController],
})
export class VuelosModule {}
