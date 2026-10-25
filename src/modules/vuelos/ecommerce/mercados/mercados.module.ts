import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../auth/roles.guard';
import { VuelosCoreModule } from '../../vuelos-core.module';
import { AuditoriaCambio } from './entities/auditoria-cambio.entity';
import { Mercado } from './entities/mercado.entity';
import {
  MercadoDocumentoLegal,
  MercadoIdentificacionFiscal,
  MercadoIdioma,
  MercadoMedioCuota,
  MercadoMedioMarca,
  MercadoMedioPago,
  MercadoMedioProducto,
  MercadoProducto,
  MercadoRegla,
  MercadoReglaFamilia,
} from './entities/mercado-config.entity';
import { AdminMercadosController, MercadosController } from './mercados.controller';
import { MercadosService } from './mercados.service';

@Module({
  imports: [VuelosCoreModule, TypeOrmModule.forFeature([
      Mercado,
      MercadoIdioma,
      MercadoProducto,
      MercadoIdentificacionFiscal,
      MercadoDocumentoLegal,
      MercadoMedioPago,
      MercadoMedioMarca,
      MercadoMedioCuota,
      MercadoMedioProducto,
      MercadoRegla,
      MercadoReglaFamilia,
      AuditoriaCambio,
    ])],
  controllers: [MercadosController, AdminMercadosController],
  providers: [MercadosService, RolesGuard],
  exports: [MercadosService, TypeOrmModule],
})
export class MercadosModule {}
