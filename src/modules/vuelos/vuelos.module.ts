import { Module } from '@nestjs/common';
import { EcommerceModule } from './ecommerce/ecommerce.module';
import { VuelosController } from './vuelos.controller';
import { VuelosCoreModule } from './vuelos-core.module';

@Module({
  imports: [VuelosCoreModule, EcommerceModule],
  controllers: [VuelosController],
})
export class VuelosModule {}
