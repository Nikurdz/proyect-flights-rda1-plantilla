import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VuelosCoreModule } from '../../vuelos-core.module';
import { MercadosModule } from '../mercados/mercados.module';
import { CatalogoController } from './catalogo.controller';
import { CatalogoService } from './catalogo.service';
import { Localidad } from './entities/localidad.entity';
import { PreciosService } from './precios.service';

@Module({
  imports: [VuelosCoreModule, MercadosModule, TypeOrmModule.forFeature([Localidad])],
  controllers: [CatalogoController],
  providers: [CatalogoService, PreciosService],
  exports: [CatalogoService, PreciosService],
})
export class CatalogoModule {}
