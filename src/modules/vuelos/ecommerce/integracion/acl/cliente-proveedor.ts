import { Inject, Injectable } from '@nestjs/common';
import { UnsafeUrlError, requestJson, resolveSafeTarget } from '../../../common/safe-http';
import { VUELOS_CONFIG, VuelosConfig } from '../../../common/vuelos-config';

/** The partner answered with a server error or did not answer: what trips the circuit breaker. */
export class ProveedorCaidoError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export interface RespuestaProveedor {
  status: number;
  /** The parsed JSON body, or null when the answer had none or it was not JSON. */
  json: unknown;
  latenciaMs: number;
}

/**
 * The HTTP door to a partner service. The address is validated like a webhook URL (SSRF guard: public https unless
 * the private-hosts switch is on), the wait and the answer are bounded, and a 5xx or a network error raises
 * `ProveedorCaidoError`. A 4xx is a business answer of the partner and is returned for the adapter to interpret.
 */
@Injectable()
export class ClienteProveedor {
  constructor(@Inject(VUELOS_CONFIG) private readonly config: VuelosConfig) {}

  async validarUrl(url: string): Promise<void> {
    await resolveSafeTarget(url, this.config.integraciones.allowPrivateHosts);
  }

  async llamar(method: 'GET' | 'POST', url: string, body?: unknown, headers: Record<string, string> = {}): Promise<RespuestaProveedor> {
    const inicio = Date.now();
    let target;
    try {
      target = await resolveSafeTarget(url, this.config.integraciones.allowPrivateHosts);
    } catch (error) {
      if (error instanceof UnsafeUrlError) throw new ProveedorCaidoError(`address rejected: ${error.message}`);
      throw error;
    }
    let respuesta;
    try {
      respuesta = await requestJson(target, method, body === undefined ? null : JSON.stringify(body), headers, {
        timeoutMs: this.config.integraciones.timeoutMs,
        maxResponseBytes: this.config.integraciones.maxResponseBytes,
      });
    } catch (error) {
      throw new ProveedorCaidoError(error instanceof Error ? error.message : String(error));
    }
    const latenciaMs = Date.now() - inicio;
    if (respuesta.status >= 500 || respuesta.status === 0) throw new ProveedorCaidoError(`the service answered ${respuesta.status}`, respuesta.status);
    let json: unknown;
    try {
      json = respuesta.body ? JSON.parse(respuesta.body) : null;
    } catch {
      json = null;
    }
    return { status: respuesta.status, json, latenciaMs };
  }
}
