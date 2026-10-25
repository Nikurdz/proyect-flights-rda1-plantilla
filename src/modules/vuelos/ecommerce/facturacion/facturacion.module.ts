import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatosFacturacion } from './entities/datos-facturacion.entity';
import { FacturaDetalle } from './entities/factura-detalle.entity';
import { Factura } from './entities/factura.entity';
import { FacturacionService } from './facturacion.service';

@Module({
  imports: [TypeOrmModule.forFeature([Factura, FacturaDetalle, DatosFacturacion])],
  providers: [FacturacionService],
  exports: [FacturacionService, TypeOrmModule],
})
export class FacturacionModule {}
