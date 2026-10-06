// Ports for the payment orchestrator's externals (SRS §8.1: "socios como puertos"). The domain
// talks to these interfaces only; swapping the simulated adapters for a real gateway and fraud
// engine changes the provider binding in PagosModule and nothing else.

export const PASARELA_PAGO = Symbol('PASARELA_PAGO');
export const ANTIFRAUDE = Symbol('ANTIFRAUDE');

export interface SolicitudAutorizacion {
  monto: number;
  moneda: string;
  /** Token produced by the gateway's hosted fields: the PAN never reaches this service. */
  token: string;
  marca: string;
  cuotas: number;
  /** Stable per purchase, so the gateway can deduplicate a retried authorisation. */
  referencia: string;
}

export type RespuestaAutorizacion =
  | { aprobado: true; autorizacionRef: string; ultimos4: string }
  | { aprobado: false; codigoRechazo: string };

export interface PasarelaPago {
  autorizar(solicitud: SolicitudAutorizacion): Promise<RespuestaAutorizacion>;
  capturar(autorizacionRef: string, monto: number): Promise<void>;
  /** Releases an authorisation (compensation). Must be safe to repeat. */
  anular(autorizacionRef: string): Promise<void>;
  /** Returns part or all of a CAPTURED payment to the card. Must be safe to repeat. */
  reembolsar(autorizacionRef: string, monto: number): Promise<void>;
}

export interface SolicitudAntifraude {
  monto: number;
  moneda: string;
  /** The amount in USD cents, so rules do not depend on each market's currency. */
  montoUsdCents: number;
  token: string;
  mercado: string;
  ownerId: string;
  intentosFallidosPrevios: number;
}

export interface RespuestaAntifraude {
  veredicto: 'APROBAR' | 'REVISAR' | 'RECHAZAR';
  puntaje: number;
  motivos: string[];
}

export interface Antifraude {
  evaluar(solicitud: SolicitudAntifraude): Promise<RespuestaAntifraude>;
}
