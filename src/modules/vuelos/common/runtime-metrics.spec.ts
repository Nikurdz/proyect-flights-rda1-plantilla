import { RuntimeMetrics } from './runtime-metrics';

describe('RuntimeMetrics', () => {
  it('counts requests, errors and latency per route', () => {
    const m = new RuntimeMetrics();
    m.recordRequest('GET', '/api/v1/ofertas/:id', 200, 10);
    m.recordRequest('GET', '/api/v1/ofertas/:id', 404, 30);
    m.recordRequest('POST', '/api/v1/ofertas/:id/compra', 502, 100);

    const s = m.snapshot();
    expect(s.requests).toEqual({ total: 3, clientErrors: 1, serverErrors: 1 });
    expect(s.routes[0]).toEqual({ route: 'GET /api/v1/ofertas/:id', count: 2, clientErrors: 1, serverErrors: 0, avgMs: 20, maxMs: 30 });
  });

  it('keeps the route table bounded', () => {
    const m = new RuntimeMetrics();
    for (let i = 0; i < 500; i += 1) m.recordRequest('GET', `/odd/${i}`, 404, 1);
    expect(m.snapshot().requests.total).toBe(500);
    expect(m.snapshot().routes.length).toBeLessThanOrEqual(25); // the report is capped too
  });

  it('counts problem codes, events, consumer failures and rate limiting', () => {
    const m = new RuntimeMetrics();
    m.recordProblem('SEAT_TAKEN');
    m.recordProblem('SEAT_TAKEN');
    m.recordEvent('OrdenEmitida');
    m.recordConsumerFailure('OrdenEmitida');
    m.recordRateLimited();

    const s = m.snapshot();
    expect(s.problemCodes).toEqual({ SEAT_TAKEN: 2 });
    expect(s.events).toEqual({ OrdenEmitida: 1 });
    expect(s.consumerFailures).toEqual({ OrdenEmitida: 1 });
    expect(s.rateLimited).toBe(1);
  });

  it('remembers the last run of a job and clears the error after a good run', () => {
    const m = new RuntimeMetrics();
    m.recordJob('reconciliacion', { durationMs: 12, error: 'db down' });
    expect(m.snapshot().jobs.reconciliacion).toMatchObject({ runs: 1, failures: 1, lastError: 'db down' });

    m.recordJob('reconciliacion', { durationMs: 8, result: { pagos: 2, anuncios: 0 } });
    expect(m.snapshot().jobs.reconciliacion).toMatchObject({ runs: 2, failures: 1, lastError: null, lastResult: { pagos: 2, anuncios: 0 }, lastDurationMs: 8 });
  });
});
