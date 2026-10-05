import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VuelosCoreModule } from '../../vuelos-core.module';
import { MercadosModule } from '../mercados/mercados.module';
import { OfertasModule } from '../ofertas/ofertas.module';
import { PagosModule } from '../pagos/pagos.module';
import { ComprasService } from './compras.service';
import { Orden } from './entities/orden.entity';
import { ClienteOrdenesController, ComprasController, OrdenesController } from './ordenes.controller';
import { OrdenesService } from './ordenes.service';

@Module({
  imports: [VuelosCoreModule, MercadosModule, OfertasModule, PagosModule, TypeOrmModule.forFeature([Orden])],
  controllers: [ComprasController, OrdenesController, ClienteOrdenesController],
  providers: [OrdenesService, ComprasService],
  exports: [OrdenesService, TypeOrmModule],
})
export class OrdenesModule {}
