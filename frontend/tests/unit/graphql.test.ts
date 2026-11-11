import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/auth-actions', () => ({ endSession: vi.fn() }));
vi.mock('../../src/lib/storage', () => ({ getStoredToken: vi.fn(() => 'jwt-token') }));
vi.mock('../../src/api/client', () => ({ API_BASE_URL: '/api/v1' }));

import { endSession } from '../../src/lib/auth-actions';
import { getStoredToken } from '../../src/lib/storage';
import { graphqlProblem, graphqlRequest, resolveGraphqlUrl } from '../../src/api/graphql';
import { ProblemDetailsError } from '../../src/api/problem-details';

const reply = (body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) =>
  Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: init.status ?? 200, headers: { 'content-type': 'application/json', ...init.headers } }));

describe('resolveGraphqlUrl', () => {
  it('drops the REST prefix: the gateway lives at the root', () => {
    expect(resolveGraphqlUrl('/api/v1')).toBe('/graphql');
    expect(resolveGraphqlUrl('https://api.example.com/api/v1')).toBe('https://api.example.com/graphql');
    expect(resolveGraphqlUrl('https://api.example.com/api/v1/')).toBe('https://api.example.com/graphql');
    expect(resolveGraphqlUrl('https://api.example.com/base')).toBe('https://api.example.com/graphql');
  });

  it('honours an explicit override', () => {
    expect(resolveGraphqlUrl('/api/v1', 'https://gw.example.com/graphql')).toBe('https://gw.example.com/graphql');
  });
});

describe('graphqlRequest', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.mocked(endSession).mockReset();
    vi.mocked(getStoredToken).mockReturnValue('jwt-token');
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('posts the query with the Bearer token and returns data', async () => {
    fetchMock.mockReturnValue(reply({ data: { auditoriaSagas: [] } }));
    const data = await graphqlRequest<{ auditoriaSagas: unknown[] }>('query { x }', { limite: 5 });
    expect(data).toEqual({ auditoriaSagas: [] });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/graphql');
    expect(init.method).toBe('POST');
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer jwt-token');
    expect(JSON.parse(init.body as string)).toEqual({ query: 'query { x }', variables: { limite: 5 } });
  });

  it('turns extensions.code into the same error the REST client throws', async () => {
    fetchMock.mockReturnValue(reply({ data: null, errors: [{ message: 'nope', extensions: { code: 'FORBIDDEN' } }] }, { headers: { 'x-correlation-id': 'corr-1' } }));
    const err = await graphqlRequest('query { x }').catch((e) => e);
    expect(err).toBeInstanceOf(ProblemDetailsError);
    expect(err).toMatchObject({ code: 'FORBIDDEN', status: 403, correlationId: 'corr-1' });
    expect(err.message).toBe('No tienes permiso para ver esta información.');
    expect(endSession).not.toHaveBeenCalled();
  });

  it('ends the session on UNAUTHORIZED, like the REST client does on 401', async () => {
    fetchMock.mockReturnValue(reply({ data: null, errors: [{ extensions: { code: 'UNAUTHORIZED' } }] }));
    await expect(graphqlRequest('query { x }')).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
    expect(endSession).toHaveBeenCalledTimes(1);
  });

  it('maps validation failures and unknown codes', () => {
    expect(graphqlProblem([{ extensions: { code: 'VALIDATION_FAILED' } }], 200)).toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    expect(graphqlProblem([{ extensions: { code: 'X', status: 409 } }], 200)).toMatchObject({ status: 409 });
    expect(graphqlProblem(undefined, 502)).toMatchObject({ status: 502 });
  });

  it('never exposes an HTML error page: it becomes a plain failure', async () => {
    fetchMock.mockReturnValue(reply('<html>Bad gateway</html>', { status: 502 }));
    await expect(graphqlRequest('query { x }')).rejects.toMatchObject({ status: 502 });
  });

  it('reports an unreachable server as SERVICE_UNAVAILABLE', async () => {
    fetchMock.mockRejectedValue(new TypeError('failed to fetch'));
    await expect(graphqlRequest('query { x }')).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE', status: 503 });
  });
});
