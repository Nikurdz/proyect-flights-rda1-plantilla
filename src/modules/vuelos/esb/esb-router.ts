import { Injectable, Logger } from '@nestjs/common';
import type { AuthClaims } from '../auth/token.service';
import { runtimeMetrics } from '../common/runtime-metrics';

export type RutaHandler<I = never, O = unknown> = (entrada: I, auth: AuthClaims | null) => Promise<O>;

/**
 * The router of the internal service bus. The gateway (GraphQL) does not call the domain services itself: it asks the
 * bus for a named operation (`reservas.mias`, `experiencias.reservar`…) and the bus runs the handler registered for it.
 * That keeps one door between the outside and the domains, where each call is timed (it shows in the runtime metrics
 * as `ESB <operation>`) and failures are logged with the same correlation id as the rest of the request.
 */
@Injectable()
export class EsbRouter {
  private readonly logger = new Logger(EsbRouter.name);
  private readonly rutas = new Map<string, RutaHandler<never, unknown>>();

  registrar<I, O>(nombre: string, handler: RutaHandler<I, O>): void {
    if (this.rutas.has(nombre)) throw new Error(`ESB route "${nombre}" is already registered`);
    this.rutas.set(nombre, handler as RutaHandler<never, unknown>);
  }

  existe(nombre: string): boolean {
    return this.rutas.has(nombre);
  }

  rutasRegistradas(): string[] {
    return [...this.rutas.keys()].sort();
  }

  async invocar<O = unknown, I = unknown>(nombre: string, entrada: I, auth: AuthClaims | null = null): Promise<O> {
    const handler = this.rutas.get(nombre);
    if (!handler) throw new Error(`No ESB route "${nombre}"`);
    const inicio = Date.now();
    try {
      const salida = (await (handler as RutaHandler<I, O>)(entrada, auth)) as O;
      runtimeMetrics.recordRequest('ESB', nombre, 200, Date.now() - inicio);
      return salida;
    } catch (error) {
      runtimeMetrics.recordRequest('ESB', nombre, (error as { getStatus?: () => number }).getStatus?.() ?? 500, Date.now() - inicio);
      this.logger.warn(`${nombre} failed in ${Date.now() - inicio} ms: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
