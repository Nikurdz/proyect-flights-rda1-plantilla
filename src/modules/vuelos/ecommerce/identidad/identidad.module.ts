import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VuelosCoreModule } from '../../vuelos-core.module';
import { MercadosModule } from '../mercados/mercados.module';
import { Cliente } from './entities/cliente.entity';
import { AuthController, ClientesController } from './identidad.controller';
import { IdentidadService } from './identidad.service';

@Module({
  imports: [VuelosCoreModule, MercadosModule, TypeOrmModule.forFeature([Cliente])],
  controllers: [AuthController, ClientesController],
  providers: [IdentidadService],
  exports: [IdentidadService, TypeOrmModule],
})
export class IdentidadModule {}
