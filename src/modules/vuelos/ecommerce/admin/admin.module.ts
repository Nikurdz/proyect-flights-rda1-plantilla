import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../auth/roles.guard';
import { Booking } from '../../entities/booking.entity';
import { SeatAssignment } from '../../entities/seat-assignment.entity';
import { Vuelo } from '../../entities/vuelo.entity';
import { VuelosCoreModule } from '../../vuelos-core.module';
import { OrdenesModule } from '../ordenes/ordenes.module';
import { IdentidadModule } from '../identidad/identidad.module';
import { AuditoriaCambio } from '../mercados/entities/auditoria-cambio.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DashboardController } from './dashboard.controller';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { VuelosAdminService } from './vuelos-admin.service';
import { DashboardService } from './dashboard.service';
import { HealthController, ObservabilidadController } from './observabilidad.controller';
import { ObservabilidadService } from './observabilidad.service';

@Module({
  imports: [VuelosCoreModule, OrdenesModule, IdentidadModule, TypeOrmModule.forFeature([Vuelo, SeatAssignment, Booking, AuditoriaCambio])],
  controllers: [AdminController, ObservabilidadController, DashboardController, UsuariosController, HealthController],
  providers: [AdminService, VuelosAdminService, UsuariosService, ObservabilidadService, DashboardService, RolesGuard],
})
export class AdminModule {}
