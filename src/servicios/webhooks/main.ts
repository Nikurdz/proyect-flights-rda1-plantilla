import { alFallar, arrancarSatelite } from '../comun/satelite';
import { WebhooksModule } from './webhooks.module';

arrancarSatelite({ rol: 'webhooks', modulo: WebhooksModule, puertoPorDefecto: 3003 }).catch(alFallar);
