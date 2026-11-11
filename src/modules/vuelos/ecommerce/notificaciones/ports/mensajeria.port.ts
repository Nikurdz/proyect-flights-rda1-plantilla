import { Injectable, Logger } from '@nestjs/common';

export const CANAL_MENSAJERIA = Symbol('CANAL_MENSAJERIA');

export interface MensajeSaliente {
  canal: 'EMAIL';
  destinatario: string;
  asunto: string;
  cuerpo: string;
}

/** Port to the messaging providers (mail, SMS, push, WhatsApp). Only e-mail exists in this phase. */
export interface CanalMensajeria {
  enviar(mensaje: MensajeSaliente): Promise<void>;
}

/**
 * SIMULATED e-mail channel: nothing leaves the process. In development it prints the message
 * (so a verification link can be followed); outside development it logs metadata only, because
 * bodies carry personal data and one-time links.
 */
@Injectable()
export class MensajeriaSimulada implements CanalMensajeria {
  private readonly logger = new Logger('MensajeriaSimulada');

  async enviar(mensaje: MensajeSaliente): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(`[SIMULATED EMAIL] to=${mensaje.destinatario} subject="${mensaje.asunto}"\n${mensaje.cuerpo}`);
    } else {
      this.logger.log(`[SIMULATED EMAIL] to=${mensaje.destinatario} subject="${mensaje.asunto}"`);
    }
  }
}
