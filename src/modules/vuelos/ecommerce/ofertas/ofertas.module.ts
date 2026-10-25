import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VuelosCoreModule } from '../../vuelos-core.module';
import { CatalogoModule } from '../catalogo/catalogo.module';
import { Localidad } from '../catalogo/entities/localidad.entity';
import { MercadosModule } from '../mercados/mercados.module';
import { DatosFacturacion } from '../facturacion/entities/datos-facturacion.entity';
import { AceptacionCondiciones } from './entities/aceptacion-condiciones.entity';
import { Oferta } from './entities/oferta.entity';
import { OfertaPasajero, OfertaPasajeroAsiento, OfertaPasajeroNecesidad } from './entities/oferta-pasajero.entity';
import { OfertaTrayecto } from './entities/oferta-trayecto.entity';
import { OfertaTrayectoPrecio } from './entities/oferta-trayecto-precio.entity';
import { OfertasController } from './ofertas.controller';
import { OfertasService } from './ofertas.service';

@Module({
  imports: [VuelosCoreModule, MercadosModule, CatalogoModule, TypeOrmModule.forFeature([
      Oferta,
      OfertaTrayecto,
      OfertaTrayectoPrecio,
      OfertaPasajero,
      OfertaPasajeroAsiento,
      OfertaPasajeroNecesidad,
      AceptacionCondiciones,
      DatosFacturacion,
      Localidad,
    ])],
  controllers: [OfertasController],
  providers: [OfertasService],
  exports: [OfertasService, TypeOrmModule],
})
export class OfertasModule {}
