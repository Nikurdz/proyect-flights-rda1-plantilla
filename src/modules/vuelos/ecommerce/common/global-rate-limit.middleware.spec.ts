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
