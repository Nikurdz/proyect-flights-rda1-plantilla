import { alFallar, arrancarSatelite } from '../comun/satelite';
import { NotificacionesAppModule } from './notificaciones.module';

arrancarSatelite({ rol: 'notificaciones', modulo: NotificacionesAppModule, puertoPorDefecto: 3002 }).catch(alFallar);
