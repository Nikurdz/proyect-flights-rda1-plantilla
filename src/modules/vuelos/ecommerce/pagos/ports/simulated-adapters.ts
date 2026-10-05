import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  Antifraude,
  PasarelaPago,
  RespuestaAntifraude,
  RespuestaAutorizacion,
  SolicitudAntifraude,
  SolicitudAutorizacion,
} from './pagos.ports';

// Test tokens understood by the simulated gateway: `tok_<brand>_ok` approves; the others force
// a specific outcome so every branch of the purchase saga can be exercised without a real PSP.
const BRAND_LAST4: Record<string, string> = { visa: '4242', mastercard: '5454', amex: '0005', diners: '3704' };
const DECLINES: Record<string, string> = {
  tok_declined: 'card_declined',
  tok_insufficient: 'insufficient_funds',
  tok_expired: 'expired_card',
  tok_3ds: '3ds_not_supported',
};

type AuthState = 'AUTHORIZED' | 'CAPTURED' | 'VOIDED';

/**
 * SIMULATED payment gateway. It moves no money. It exists so RDA1 can run the whole purchase
 * flow, including declines and compensation, end to end; a real PSP adapter implementing
 * PasarelaPago replaces it in PagosModule.
 */
@Injectable()
export class PasarelaSimulada implements PasarelaPago {
  private readonly logger = new Logger('PasarelaSimulada');
  private readonly byReference = new Map<string, string>();
  private readonly states = new Map<string, AuthState>();
  private readonly failCapture = new Set<string>();

  async autorizar(solicitud: SolicitudAutorizacion): Promise<RespuestaAutorizacion> {
    // Deduplicate on the purchase reference: a retried authorisation returns the original.
    const previous = this.byReference.get(solicitud.referencia);
    if (previous) {
      return { aprobado: true, autorizacionRef: previous, ultimos4: this.last4For(solicitud.token) };
    }

    const decline = DECLINES[solicitud.token];
    if (decline) return { aprobado: false, codigoRechazo: decline };

    const match = /^tok_(visa|mastercard|amex|diners)_(ok|capture_fail)$/.exec(solicitud.token);
    if (!match) return { aprobado: false, codigoRechazo: 'invalid_token' };
    if (match[1] !== solicitud.marca.toLowerCase()) return { aprobado: false, codigoRechazo: 'brand_mismatch' };

    const autorizacionRef = `auth_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
    this.byReference.set(solicitud.referencia, autorizacionRef);
    this.states.set(autorizacionRef, 'AUTHORIZED');
    if (match[2] === 'capture_fail') this.failCapture.add(autorizacionRef);
    this.logger.warn(`SIMULATED authorisation ${autorizacionRef} (${solicitud.moneda}) — no real charge`);
    return { aprobado: true, autorizacionRef, ultimos4: BRAND_LAST4[match[1]] };
  }

  async capturar(autorizacionRef: string): Promise<void> {
    const state = this.states.get(autorizacionRef);
    if (state === 'CAPTURED') return;
    if (state !== 'AUTHORIZED') throw new Error(`Authorisation ${autorizacionRef} cannot be captured (${state ?? 'unknown'})`);
    if (this.failCapture.has(autorizacionRef)) throw new Error('Simulated capture failure');
    this.states.set(autorizacionRef, 'CAPTURED');
  }

  async anular(autorizacionRef: string): Promise<void> {
    // Voiding an unknown or already-voided authorisation is a no-op: compensation must be repeatable.
    if (this.states.get(autorizacionRef) === 'AUTHORIZED') {
      this.states.set(autorizacionRef, 'VOIDED');
    }
  }

  private last4For(token: string): string {
    const brand = /^tok_([a-z]+)_/.exec(token)?.[1] ?? '';
    return BRAND_LAST4[brand] ?? '0000';
  }
}

const REVIEW_THRESHOLD_USD_CENTS = 500_000; // 5,000 USD
const MAX_PRIOR_FAILURES = 3;

/** SIMULATED fraud engine: a few transparent rules standing in for a real scoring service. */
@Injectable()
export class AntifraudeSimulado implements Antifraude {
  async evaluar(solicitud: SolicitudAntifraude): Promise<RespuestaAntifraude> {
    if (solicitud.token === 'tok_fraud') {
      return { veredicto: 'RECHAZAR', puntaje: 95, motivos: ['blocked_token'] };
    }
    if (solicitud.intentosFallidosPrevios >= MAX_PRIOR_FAILURES) {
      return { veredicto: 'RECHAZAR', puntaje: 90, motivos: ['too_many_failed_attempts'] };
    }
    if (solicitud.token === 'tok_review' || solicitud.montoUsdCents > REVIEW_THRESHOLD_USD_CENTS) {
      return { veredicto: 'REVISAR', puntaje: 60, motivos: [solicitud.token === 'tok_review' ? 'manual_review_token' : 'high_amount'] };
    }
    return { veredicto: 'APROBAR', puntaje: 5, motivos: [] };
  }
}
