import { ProblemDetailsError } from '../api/problem-details';

export const NETWORK_MESSAGE = 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';

/** The client turns a failed fetch (no answer at all) into SERVICE_UNAVAILABLE without a correlation id; a real 503 from the API carries one. */
export function isNetworkError(error: unknown): boolean {
  return error instanceof ProblemDetailsError && error.code === 'SERVICE_UNAVAILABLE' && !error.correlationId;
}
