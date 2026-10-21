import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { EcommerceModule } from './ecommerce/ecommerce.module';
import { VuelosController } from './vuelos.controller';
import { VuelosCoreModule } from './vuelos-core.module';

@Module({
  imports: [CommonModule, VuelosCoreModule, EcommerceModule],
  controllers: [VuelosController],
})
export class VuelosModule {}
