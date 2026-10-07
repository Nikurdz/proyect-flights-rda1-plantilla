import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../auth/roles.guard';
import { Booking } from '../../entities/booking.entity';
import { SeatAssignment } from '../../entities/seat-assignment.entity';
import { Vuelo } from '../../entities/vuelo.entity';
import { VuelosCoreModule } from '../../vuelos-core.module';
import { OrdenesModule } from '../ordenes/ordenes.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { HealthController, ObservabilidadController } from './observabilidad.controller';
import { ObservabilidadService } from './observabilidad.service';

@Module({
  imports: [VuelosCoreModule, OrdenesModule, TypeOrmModule.forFeature([Vuelo, SeatAssignment, Booking])],
  controllers: [AdminController, ObservabilidadController, DashboardController, HealthController],
  providers: [AdminService, ObservabilidadService, DashboardService, RolesGuard],
})
export class AdminModule {}
