import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../auth/roles.guard';
import { Vuelo } from '../../entities/vuelo.entity';
import { VuelosCoreModule } from '../../vuelos-core.module';
import { OrdenesModule } from '../ordenes/ordenes.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { HealthController, ObservabilidadController } from './observabilidad.controller';
import { ObservabilidadService } from './observabilidad.service';

@Module({
  imports: [VuelosCoreModule, OrdenesModule, TypeOrmModule.forFeature([Vuelo])],
  controllers: [AdminController, ObservabilidadController, HealthController],
  providers: [AdminService, ObservabilidadService, RolesGuard],
})
export class AdminModule {}
