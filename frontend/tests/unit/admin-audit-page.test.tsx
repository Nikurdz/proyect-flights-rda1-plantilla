// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/graphql', () => ({ graphqlRequest: vi.fn() }));
vi.mock('../../src/lib/session', () => ({ useSession: () => ({ ownerId: 'admin-1' }) }));

import { graphqlRequest } from '../../src/api/graphql';
import { ProblemDetailsError } from '../../src/api/problem-details';
import { AdminAuditPage } from '../../src/features/admin/AdminAuditPage';

const mocked = vi.mocked(graphqlRequest);

const tx = [
  { id: '1', eventoId: 'e1', tipo: 'order.issued', agregadoId: 'ord-1', propietarioId: 'c1', correlationId: 'corr-aaa', resumen: 'Orden emitida', ocurridoEn: '2026-10-25T10:00:00.000Z' },
];
const sagas = [
  {
    sagaId: 's1',
    tipo: 'COMPRA_EXPERIENCIA',
    referencia: 'res-1',
    correlationId: 'corr-aaa',
    estado: 'COMPENSADA',
    error: 'Provider timeout',
    iniciadaEn: '2026-10-25T10:00:00.000Z',
    finalizadaEn: '2026-10-25T10:00:03.000Z',
    pasos: [
      { secuencia: 2, nombre: 'reservar-proveedor', estado: 'FALLIDO', detalle: 'timeout', duracionMs: 2500 },
      { secuencia: 1, nombre: 'autorizar-pago', estado: 'OK', detalle: null, duracionMs: 120 },
      { secuencia: 3, nombre: 'anular-pago', estado: 'COMPENSADO', detalle: null, duracionMs: 80 },
    ],
  },
  {
    sagaId: 's2',
    tipo: 'COMPRA_VUELO',
    referencia: 'ord-2',
    correlationId: 'corr-bbb',
    estado: 'COMPLETADA',
    error: null,
    iniciadaEn: '2026-10-25T09:00:00.000Z',
    finalizadaEn: '2026-10-25T09:00:01.000Z',
    pasos: [{ secuencia: 1, nombre: 'autorizar-pago', estado: 'OK', detalle: null, duracionMs: 90 }],
  },
];

function answer(query: string, variables?: Record<string, unknown>) {
  if (query.includes('auditoriaTransacciones')) return Promise.resolve({ auditoriaTransacciones: tx });
  return Promise.resolve({ auditoriaSagas: variables?.correlationId === 'corr-bbb' ? [sagas[1]] : sagas });
}

function renderPage(initial = '/admin/auditoria') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initial]}>
        <AdminAuditPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminAuditPage', () => {
  beforeEach(() => {
    mocked.mockReset();
    mocked.mockImplementation(answer as never);
  });
  afterEach(cleanup);

  it('shows both sections: transactions and sagas', async () => {
    renderPage();
    expect(await screen.findByText('order.issued')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Transacciones/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Sagas/ })).toBeTruthy();
    expect(await screen.findByText('COMPRA_VUELO')).toBeTruthy();
  });

  it('highlights a compensated saga with text, the reason, and its steps in order with duration', async () => {
    renderPage();
    const article = (await screen.findByText('COMPRA_EXPERIENCIA')).closest('article') as HTMLElement;
    expect(within(article).getByText('Compensada (deshecha)')).toBeTruthy();
    expect(within(article).getByRole('note').textContent).toMatch(/se deshicieron sus pasos/);
    expect(within(article).getByRole('note').textContent).toMatch(/Provider timeout/);
    const rows = within(article).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell')[1].textContent)).toEqual(['autorizar-pago', 'reservar-proveedor', 'anular-pago']);
    expect(within(rows[1]).getByText('2,5 s')).toBeTruthy();
    expect(within(rows[1]).getByText('Falló')).toBeTruthy();
    // The red steps are open by default; the healthy saga stays collapsed.
    expect((article.querySelector('details') as HTMLDetailsElement).open).toBe(true);
    const healthy = screen.getByText('COMPRA_VUELO').closest('article') as HTMLElement;
    expect((healthy.querySelector('details') as HTMLDetailsElement).open).toBe(false);
    expect(screen.getByText('1 con compensación o fallo')).toBeTruthy();
  });

  it('reads the correlation id from the link and filters both sections by it', async () => {
    renderPage('/admin/auditoria?correlationId=corr-bbb');
    await screen.findByText('COMPRA_VUELO');
    await waitFor(() => expect(screen.queryByText('COMPRA_EXPERIENCIA')).toBeNull());
    expect(screen.getByRole('status').textContent).toContain('corr-bbb');
    expect((screen.getByLabelText('Correlation id') as HTMLInputElement).value).toBe('corr-bbb');
    const calls = mocked.mock.calls.map(([q, v]) => ({ q, v }));
    expect(calls.some((c) => String(c.q).includes('auditoriaTransacciones') && c.v?.correlationId === 'corr-bbb')).toBe(true);
    expect(calls.some((c) => String(c.q).includes('auditoriaSagas') && c.v?.correlationId === 'corr-bbb')).toBe(true);
  });

  it('turns a correlation id into a link that shows everything it touched', async () => {
    renderPage();
    const links = await screen.findAllByRole('link', { name: /Ver todo lo que tocó la correlación corr-aaa/ });
    expect(links[0].getAttribute('href')).toBe('/admin/auditoria?correlationId=corr-aaa');
  });

  it('applies the typed filter on submit and never sends blank filters', async () => {
    renderPage();
    await screen.findByText('order.issued');
    expect(mocked.mock.calls.every(([, v]) => !('correlationId' in (v ?? {})) && !('tipo' in (v ?? {})))).toBe(true);
    fireEvent.change(screen.getByLabelText('Correlation id'), { target: { value: '  corr-bbb ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(mocked.mock.calls.some(([, v]) => v?.correlationId === 'corr-bbb')).toBe(true));
  });

  it('shows a GraphQL FORBIDDEN as a readable problem', async () => {
    mocked.mockRejectedValue(new ProblemDetailsError({ status: 403, code: 'FORBIDDEN' }));
    renderPage();
    const alerts = await screen.findAllByRole('alert');
    expect(alerts[0].textContent).toContain('No tienes permiso para ver esta información.');
  });
});
