// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let currentSession: { kind: string; ownerId: string } | null = { kind: 'customer', ownerId: 'cust-1' };
vi.mock('../../src/api/client', () => ({ apiClient: vi.fn() }));
vi.mock('../../src/lib/session', () => ({ useSession: () => currentSession }));

import { apiClient } from '../../src/api/client';
import { ProblemDetailsError } from '../../src/api/problem-details';
import { MyExperiencesPage } from '../../src/features/experiences/MyExperiencesPage';

const mocked = vi.mocked(apiClient);

const reserva = (over: Record<string, unknown>) => ({
  id: 'r1',
  estado: 'CONFIRMADA',
  experiencia: { id: 'e1', nombre: 'Tour del Centro', proveedor: 'Atracciones Quito' },
  fecha: '2999-01-15',
  hora: '10:30',
  cantidad: 2,
  total: { moneda: 'USD', monto: '51.00' },
  referenciaProveedor: 'PRV-1',
  factura: 'FAC-AAAAAAAAAA',
  motivo: null,
  cancelacionGratis: true,
  creadaEn: '2026-10-25T10:00:00.000Z',
  ...over,
});

const items = [
  reserva({ id: 'r1' }),
  reserva({ id: 'r4', cancelacionGratis: false, factura: 'FAC-DDDDDDDDDD', experiencia: { id: 'e4', nombre: 'Cabalgata', proveedor: 'Atracciones Quito' } }),
  reserva({ id: 'r2', estado: 'CANCELADA', factura: 'FAC-CCCCCCCCCC', experiencia: { id: 'e2', nombre: 'Museo', proveedor: 'Atracciones Quito' } }),
  reserva({ id: 'r3', estado: 'FALLIDA_COMPENSADA', factura: null, motivo: 'Proveedor caído', experiencia: { id: 'e3', nombre: 'Parque', proveedor: 'Atracciones Quito' } }),
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MyExperiencesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MyExperiencesPage', () => {
  beforeEach(() => {
    currentSession = { kind: 'customer', ownerId: 'cust-1' };
    mocked.mockReset();
    mocked.mockImplementation((async (url: string) => (url === 'reservas-externas' ? { items } : {})) as never);
  });
  afterEach(cleanup);

  it('lists the bookings with state, invoice and a cancel button only for confirmed ones', async () => {
    renderPage();
    expect(await screen.findByText('Tour del Centro')).toBeTruthy();
    expect(screen.getAllByText('Confirmada')).toHaveLength(2);
    expect(screen.getByText('Cancelada')).toBeTruthy();
    expect(screen.getByText('No realizada (sin cobro)')).toBeTruthy();
    expect(screen.getByText(/Proveedor caído/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Cancelar la reserva de/ })).toHaveLength(1);
    expect(screen.getByText('FAC-AAAAAAAAAA')).toBeTruthy();
  });

  it('shows no cancel button but an explanation for a confirmed booking without free cancellation', async () => {
    renderPage();
    await screen.findByText('Cabalgata');
    expect(screen.queryByRole('button', { name: 'Cancelar la reserva de Cabalgata' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cancelar la reserva de Tour del Centro' })).toBeTruthy();
    // Only the confirmed booking without free cancellation carries the text (not cancelled/failed ones).
    expect(screen.getAllByText('Esta experiencia no admite cancelación gratuita')).toHaveLength(1);
  });

  it('cancels with confirmation and an Idempotency-Key, then shows the refund notice', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar la reserva de Tour del Centro' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Motivo (opcional)'), { target: { value: 'Cambio de planes' } });
    mocked.mockImplementation((async (url: string) => (url === 'reservas-externas' ? { items } : reserva({ estado: 'CANCELADA' }))) as never);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sí, cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText(/Cancelamos «Tour del Centro»/)).toBeTruthy();
    const call = mocked.mock.calls.find(([url]) => url === 'reservas-externas/r1/cancelar') as [string, RequestInit & { idempotencyKey?: string }];
    expect(call[1].method).toBe('POST');
    expect(call[1].idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(call[1].body as string)).toEqual({ motivo: 'Cambio de planes' });
  });

  it('explains EXTERNAL_RESERVATION_NOT_REFUNDABLE inside the dialog', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar la reserva de Tour del Centro' }));
    const dialog = await screen.findByRole('dialog');
    mocked.mockImplementation((async (url: string) => {
      if (url === 'reservas-externas') return { items };
      throw new ProblemDetailsError({ status: 409, code: 'EXTERNAL_RESERVATION_NOT_REFUNDABLE' });
    }) as never);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sí, cancelar' }));
    expect(await within(dialog).findByText(/no admite cancelación gratuita/)).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('asks a visitor without session to sign in instead of calling the API', async () => {
    currentSession = null;
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Inicia sesión para ver tus experiencias' })).toBeTruthy();
    expect(mocked).not.toHaveBeenCalled();
  });
});
