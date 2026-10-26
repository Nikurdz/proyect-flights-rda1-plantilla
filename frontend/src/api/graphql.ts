import { endSession } from '../lib/auth-actions';
import { getStoredToken } from '../lib/storage';
import { API_BASE_URL } from './client';
import { ProblemDetailsError } from './problem-details';

/**
 * Minimal GraphQL client (plain `fetch`). The gateway lives at `/graphql`, OUTSIDE the REST prefix
 * `api/v1`, so its URL is derived from the REST base unless `VITE_GRAPHQL_URL` says otherwise.
 * It reuses the REST client's token and error model: a failure ends as a `ProblemDetailsError`.
 */

/** `/api/v1` -> `/graphql`; `https://host/api/v1` -> `https://host/graphql`. */
export function resolveGraphqlUrl(apiBase: string, override?: string): string {
  if (override) return override;
  const trimmed = apiBase.replace(/\/+$/, '');
  if (/\/api\/v\d+$/.test(trimmed)) return trimmed.replace(/\/api\/v\d+$/, '/graphql');
  if (/^https?:\/\//.test(trimmed)) return `${new URL(trimmed).origin}/graphql`;
  return '/graphql';
}

interface GraphQLErrorItem {
  message?: string;
  extensions?: { code?: string; status?: number };
}

interface GraphQLResponse<T> {
  data?: T | null;
  errors?: GraphQLErrorItem[];
}

const STATUS_BY_CODE: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION_FAILED: 400,
  BAD_USER_INPUT: 400,
  GRAPHQL_VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

/** Turns the first GraphQL error into the same error type the REST client throws. */
export function graphqlProblem(errors: GraphQLErrorItem[] | undefined, httpStatus: number, correlationId?: string): ProblemDetailsError {
  const first = errors?.[0];
  const code = first?.extensions?.code;
  const status = first?.extensions?.status ?? (code ? STATUS_BY_CODE[code] : undefined) ?? (httpStatus >= 400 ? httpStatus : 500);
  return new ProblemDetailsError({ status, code }, correlationId);
}

export async function graphqlRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const url = resolveGraphqlUrl(API_BASE_URL, import.meta.env.VITE_GRAPHQL_URL);
  const headers = new Headers({ 'Content-Type': 'application/json', Accept: 'application/json' });
  const token = getStoredToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
  } catch {
    throw new ProblemDetailsError({ status: 503, code: 'SERVICE_UNAVAILABLE' });
  }

  const correlationId = response.headers.get('x-correlation-id') || undefined;
  let payload: GraphQLResponse<T> | null = null;
  try {
    payload = (await response.json()) as GraphQLResponse<T>;
  } catch {
    payload = null; // HTML from a proxy, empty body: the status says enough.
  }

  if (payload?.errors?.length || !response.ok || !payload?.data) {
    const problem = graphqlProblem(payload?.errors, response.status, correlationId);
    if (problem.status === 401 && token) endSession();
    throw problem;
  }
  return payload.data;
}
