import type { Actor } from './correlation';

/** An action that is not a domain event but belongs to the trail: a sign-in, a token, a webhook subscription, a call to a partner. */
export interface AccionTraza {
  tipo: string;
  agregadoId: string;
  /** Identifiers only: never an e-mail, a document or a secret. */
  resumen: string;
  estado?: 'OK' | 'ERROR';
  /** When the request has no verified actor yet (a sign-in): who it turned out to be. */
  actor?: Actor;
  /** For work done outside a request (a job, a delivery): the id of the request it continues. */
  correlationId?: string;
}

// Where the actions go (the audit trail); none until the observability module registers one. Same pattern as the HTTP sample.
let sink: ((accion: AccionTraza) => void) | null = null;

export function setAccionSink(next: ((accion: AccionTraza) => void) | null): void {
  sink = next;
}

/** Records an action in the trail. Never throws and never waits: recording must not change what the action does. */
export function registrarAccion(accion: AccionTraza): void {
  try {
    sink?.(accion);
  } catch {
    // The trail is best effort.
  }
}
