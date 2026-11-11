import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../auth/roles.guard';
import { VuelosCoreModule } from '../../vuelos-core.module';
import { DatosFacturacion } from './entities/datos-facturacion.entity';
import { FacturaDetalle } from './entities/factura-detalle.entity';
import { Factura } from './entities/factura.entity';
import { FacturacionAdminController } from './facturacion-admin.controller';
import { FacturacionService } from './facturacion.service';

@Module({
  imports: [VuelosCoreModule, TypeOrmModule.forFeature([Factura, FacturaDetalle, DatosFacturacion])],
  controllers: [FacturacionAdminController],
  providers: [FacturacionService, RolesGuard],
  exports: [FacturacionService, TypeOrmModule],
})
export class FacturacionModule {}
