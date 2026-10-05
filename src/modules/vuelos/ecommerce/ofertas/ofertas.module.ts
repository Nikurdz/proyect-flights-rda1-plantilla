import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VuelosCoreModule } from '../../vuelos-core.module';
import { CatalogoModule } from '../catalogo/catalogo.module';
import { Localidad } from '../catalogo/entities/localidad.entity';
import { MercadosModule } from '../mercados/mercados.module';
import { Oferta } from './entities/oferta.entity';
import { OfertasController } from './ofertas.controller';
import { OfertasService } from './ofertas.service';

@Module({
  imports: [VuelosCoreModule, MercadosModule, CatalogoModule, TypeOrmModule.forFeature([Oferta, Localidad])],
  controllers: [OfertasController],
  providers: [OfertasService],
  exports: [OfertasService, TypeOrmModule],
})
export class OfertasModule {}
