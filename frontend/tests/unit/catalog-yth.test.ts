import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiClient = vi.fn();
vi.mock('../../src/api/client', () => ({ apiClient: (...args: unknown[]) => apiClient(...args) }));

import { fetchDisponibilidad, fetchTarifas } from '../../src/api/endpoints/catalog';

describe('youths (12-17) in the availability and fare requests', () => {
  beforeEach(() => {
    apiClient.mockReset();
    apiClient.mockResolvedValue({});
  });

  it('sends yth next to adt, never merged into it', async () => {
    await fetchDisponibilidad({ origin: 'UIO', destination: 'GYE', outbound: '2026-12-01', adt: 1, yth: 2, chd: 1, inf: 1, trip: 'OW' });
    const url = String(apiClient.mock.calls[0][0]);
    expect(url).toContain('adt=1');
    expect(url).toContain('yth=2');
    expect(url).toContain('chd=1');
    expect(url).toContain('inf=1');
  });

  it('omits yth when there are no youths', async () => {
    await fetchDisponibilidad({ origin: 'UIO', destination: 'GYE', adt: 2, yth: 0 });
    expect(String(apiClient.mock.calls[0][0])).not.toContain('yth');
  });

  it('sends yth in the fares of an itinerary too', async () => {
    await fetchTarifas('it-1', { adt: 1, yth: 1, chd: 0, inf: 0 });
    expect(String(apiClient.mock.calls[0][0])).toContain('yth=1');
  });
});
