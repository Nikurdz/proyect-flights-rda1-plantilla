import { Module } from '@nestjs/common';
import { NotificacionesModule } from '../../modules/vuelos/ecommerce/notificaciones/notificaciones.module';
import { crearHealthController } from '../comun/health.controller';
import { infraSatelite, SateliteBaseModule } from '../comun/satelite';

/** The notification service: turns order and account events into messages (`ecom_notificaciones`) through the simulated mail channel. */
@Module({
  imports: [SateliteBaseModule, NotificacionesModule],
  controllers: [crearHealthController('notificaciones')],
})
export class NotificacionesServicioModule {}

/** Root module of the process (`dist/servicios/notificaciones/main.js`). */
@Module({ imports: [...infraSatelite(), NotificacionesServicioModule] })
export class NotificacionesAppModule {}
