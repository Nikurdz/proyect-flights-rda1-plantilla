import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../auth/roles.guard';
import { VuelosCoreModule } from '../../vuelos-core.module';
import { MercadosModule } from '../mercados/mercados.module';
import { Notificacion } from './entities/notificacion.entity';
import { PlantillaNotificacion } from './entities/plantilla.entity';
import { AdminNotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';
import { CANAL_MENSAJERIA, MensajeriaSimulada } from './ports/mensajeria.port';

@Module({
  imports: [VuelosCoreModule, MercadosModule, TypeOrmModule.forFeature([Notificacion, PlantillaNotificacion])],
  controllers: [AdminNotificacionesController],
  // RDA1 has no mail provider: the simulated channel stands behind the CanalMensajeria port.
  providers: [NotificacionesService, RolesGuard, { provide: CANAL_MENSAJERIA, useClass: MensajeriaSimulada }],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
