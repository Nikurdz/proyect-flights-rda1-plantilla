// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/client', () => ({ apiClient: vi.fn() }));

import { apiClient } from '../../src/api/client';
import { RUNTIME_REFRESH_MS, useAdminRuntime } from '../../src/api/endpoints/admin';

const mocked = vi.mocked(apiClient);

function setup(paused: boolean) {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(({ p }) => useAdminRuntime('owner-1', { paused: p }), { wrapper, initialProps: { p: paused } });
}

describe('useAdminRuntime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocked.mockReset();
    mocked.mockResolvedValue({ uptimeSeconds: 1 } as never);
  });
  afterEach(() => vi.useRealTimers());

  it('refreshes every 3 s or less', async () => {
    expect(RUNTIME_REFRESH_MS).toBeLessThanOrEqual(3000);
    setup(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(mocked).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(RUNTIME_REFRESH_MS * 2 + 100); });
    expect(mocked.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('stops the automatic refresh while paused and resumes afterwards', async () => {
    const { rerender } = setup(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    rerender({ p: true });
    const calls = mocked.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(RUNTIME_REFRESH_MS * 5); });
    expect(mocked).toHaveBeenCalledTimes(calls);
    rerender({ p: false });
    await act(async () => { await vi.advanceTimersByTimeAsync(RUNTIME_REFRESH_MS + 100); });
    expect(mocked.mock.calls.length).toBeGreaterThan(calls);
  });
});
