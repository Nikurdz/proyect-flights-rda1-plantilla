import { createGlobalRateLimit } from './global-rate-limit.middleware';

function fakeRes() {
  const res: any = { statusCode: 200, headers: {} as Record<string, string>, body: undefined as string | undefined };
  res.status = (code: number) => ((res.statusCode = code), res);
  res.set = (name: string, value: string) => ((res.headers[name] = value), res);
  res.type = () => res;
  res.send = (body: string) => ((res.body = body), res);
  return res;
}

describe('createGlobalRateLimit', () => {
  const req = (ip: string, path = '/api/v1/search', method = 'GET') => ({ ip, path, method }) as any;

  it('lets requests through until the window is full, then answers 429 problem+json with Retry-After', () => {
    const limit = createGlobalRateLimit({ GLOBAL_RATE_LIMIT_MAX: '2' } as any);
    const next = jest.fn();
    limit(req('1.1.1.1'), fakeRes(), next);
    limit(req('1.1.1.1'), fakeRes(), next);
    expect(next).toHaveBeenCalledTimes(2);

    const res = fakeRes();
    limit(req('1.1.1.1'), res, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBe(429);
    expect(Number(res.headers['Retry-After'])).toBeGreaterThanOrEqual(1);
    expect(JSON.parse(res.body!).code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('answers a v2 ProblemDetails (instance, correlation_id, timestamp) on /api/v2 and keeps the v1 body elsewhere', () => {
    const limit = createGlobalRateLimit({ GLOBAL_RATE_LIMIT_MAX: '1' } as any);
    const next = jest.fn();
    const v2 = (ip: string) => ({ ip, path: '/api/v2/vuelos/search', method: 'POST', headers: { 'x-correlation-id': 'corr-vuelos-123' } }) as any;
    limit(v2('3.3.3.3'), fakeRes(), next);
    const res = fakeRes();
    limit(v2('3.3.3.3'), res, next);
    expect(res.statusCode).toBe(429);
    expect(JSON.parse(res.body!)).toMatchObject({ code: 'RATE_LIMIT_EXCEEDED', instance: '/api/v2/vuelos/search', correlation_id: 'corr-vuelos-123' });
    expect(JSON.parse(res.body!).timestamp).toBeDefined();
    expect(res.headers['X-Correlation-Id']).toBe('corr-vuelos-123');
    // The v2 health probe is never throttled.
    limit({ ip: '3.3.3.3', path: '/api/v2/vuelos/health', method: 'GET' } as any, fakeRes(), next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('counts each client separately and never throttles health checks or preflight', () => {
    const limit = createGlobalRateLimit({ GLOBAL_RATE_LIMIT_MAX: '1' } as any);
    const next = jest.fn();
    limit(req('1.1.1.1'), fakeRes(), next);
    limit(req('2.2.2.2'), fakeRes(), next);
    limit(req('1.1.1.1', '/api/v1/health'), fakeRes(), next);
    limit(req('1.1.1.1', '/api/v1/search', 'OPTIONS'), fakeRes(), next);
    expect(next).toHaveBeenCalledTimes(4);
  });

  it('is disabled with GLOBAL_RATE_LIMIT_MAX=0', () => {
    const limit = createGlobalRateLimit({ GLOBAL_RATE_LIMIT_MAX: '0' } as any);
    const next = jest.fn();
    for (let i = 0; i < 1000; i++) limit(req('1.1.1.1'), fakeRes(), next);
    expect(next).toHaveBeenCalledTimes(1000);
  });
});
