import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import CircuitBreaker = require('opossum');
import { ProblemDetailsException } from '../../../common/problem-details.exception';
import { VUELOS_CONFIG, VuelosConfig } from '../../../common/vuelos-config';
import { ProveedorCaidoError } from './cliente-proveedor';

export type EstadoCircuito = 'CERRADO' | 'ABIERTO' | 'SEMIABIERTO';

type Accion = () => Promise<unknown>;

/**
 * One circuit breaker per provider. While a partner keeps failing (network errors, timeouts, 5xx) the circuit opens and
 * calls fail at once with 503 instead of piling up on a dead service; after `breakerResetMs` one trial call decides
 * whether it closes again. A business refusal (4xx) is not a failure of the service and never counts.
 */
@Injectable()
export class CircuitBreakers {
  private readonly breakers = new Map<string, CircuitBreaker<[Accion], unknown>>();

  constructor(@Inject(VUELOS_CONFIG) private readonly config: VuelosConfig) {}

  async ejecutar<T>(proveedorId: string, accion: () => Promise<T>): Promise<T> {
    try {
      return (await this.breaker(proveedorId).fire(accion)) as T;
    } catch (error) {
      if (error instanceof ProveedorCaidoError) {
        throw new ProblemDetailsException(HttpStatus.SERVICE_UNAVAILABLE, 'PROVIDER_UNAVAILABLE', 'Provider unavailable', `The provider did not answer correctly: ${error.message}.`);
      }
      if ((error as { code?: string }).code === 'EOPENBREAKER') {
        throw new ProblemDetailsException(HttpStatus.SERVICE_UNAVAILABLE, 'PROVIDER_UNAVAILABLE', 'Provider unavailable', 'The provider is failing and its circuit is open; try again in a moment.');
      }
      throw error;
    }
  }

  estado(proveedorId: string): EstadoCircuito {
    const breaker = this.breakers.get(proveedorId);
    if (!breaker || breaker.closed) return 'CERRADO';
    return breaker.opened ? 'ABIERTO' : 'SEMIABIERTO';
  }

  /** Closes the circuit by hand (an admin who knows the partner is back). */
  reiniciar(proveedorId: string): void {
    this.breakers.get(proveedorId)?.close();
  }

  olvidar(proveedorId: string): void {
    this.breakers.get(proveedorId)?.shutdown();
    this.breakers.delete(proveedorId);
  }

  private breaker(proveedorId: string): CircuitBreaker<[Accion], unknown> {
    let breaker = this.breakers.get(proveedorId);
    if (!breaker) {
      breaker = new CircuitBreaker<[Accion], unknown>((accion) => accion(), {
        timeout: false, // the HTTP client already bounds the wait
        errorFilter: (error: unknown) => !(error instanceof ProveedorCaidoError), // only service failures count
        errorThresholdPercentage: 50,
        volumeThreshold: 3,
        resetTimeout: this.config.integraciones.breakerResetMs,
        rollingCountTimeout: 60_000,
      });
      this.breakers.set(proveedorId, breaker);
    }
    return breaker;
  }
}
