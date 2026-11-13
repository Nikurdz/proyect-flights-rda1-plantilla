// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProblemAlert } from '../../src/components/common/ProblemAlert';
import { ProblemDetailsError } from '../../src/api/problem-details';
import { isNetworkError } from '../../src/lib/network-error';

afterEach(cleanup);

describe('ProblemAlert', () => {
  it('shows a specific message and a retry button when the server did not answer at all', () => {
    const onRetry = vi.fn();
    const error = new ProblemDetailsError({ status: 503, code: 'SERVICE_UNAVAILABLE' });
    render(<ProblemAlert error={error} onRetry={onRetry} />);
    expect(screen.getByRole('alert').textContent).toContain('No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not treat a 503 that came from the API (it has a correlation id) as a network failure', () => {
    const error = new ProblemDetailsError({ status: 503, code: 'SERVICE_UNAVAILABLE' }, 'corr-1');
    expect(isNetworkError(error)).toBe(false);
    render(<ProblemAlert error={error} />);
    expect(screen.getByRole('alert').textContent).not.toContain('Revisa tu conexión');
  });

  it('shows the support code as copyable text next to the copy button', () => {
    const error = new ProblemDetailsError({ status: 409, code: 'SEAT_TAKEN' }, 'abc-123');
    render(<ProblemAlert error={error} />);
    expect(screen.getByText('SEAT_TAKEN·abc-123')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copiar código para soporte' })).toBeTruthy();
  });

  it('never shows the text of an unknown error', () => {
    render(<ProblemAlert error={new Error('TypeError: x is undefined')} />);
    expect(screen.getByRole('alert').textContent).not.toContain('TypeError');
  });
});
