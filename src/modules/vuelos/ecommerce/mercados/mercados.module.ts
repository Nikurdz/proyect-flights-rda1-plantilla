import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../auth/roles.guard';
import { VuelosCoreModule } from '../../vuelos-core.module';
import { AuditoriaCambio } from './entities/auditoria-cambio.entity';
import { Mercado } from './entities/mercado.entity';
import { AdminMercadosController, MercadosController } from './mercados.controller';
import { MercadosService } from './mercados.service';

@Module({
  imports: [VuelosCoreModule, TypeOrmModule.forFeature([Mercado, AuditoriaCambio])],
  controllers: [MercadosController, AdminMercadosController],
  providers: [MercadosService, RolesGuard],
  exports: [MercadosService, TypeOrmModule],
})
export class MercadosModule {}
