import { alFallar, arrancarSatelite } from '../comun/satelite';
import { AuditoriaModule } from './auditoria.module';

arrancarSatelite({ rol: 'auditoria', modulo: AuditoriaModule, puertoPorDefecto: 3001 }).catch(alFallar);
