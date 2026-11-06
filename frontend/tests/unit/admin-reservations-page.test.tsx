// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/client', () => ({ apiClient: vi.fn() }));
vi.mock('../../src/lib/session', () => ({ useSession: () => ({ ownerId: 'admin-1' }) }));

import { apiClient } from '../../src/api/client';
import { ProblemDetailsError } from '../../src/api/problem-details';
import { AdminReservationsPage } from '../../src/features/admin/AdminReservationsPage';

const mocked = vi.mocked(apiClient);

const reserva = (bookingId: string, pnr: string, canal: 'SOCIO' | 'DIRECTO') => ({
  bookingId,
  pnr,
  status: 'CONFIRMED',
  canal,
  socio: canal === 'SOCIO' ? { partnerId: 'booking', partnerOrderId: 'ORD-BKP-20261104-000123' } : null,
  paymentReference: 'PAY-BKP-20261104-000123',
  paymentProvider: 'booking',
  total: { currency: 'USD', total: '350.00' },
  creadaEn: '2026-11-05T10:00:00.000Z',
  vuelos: [{ vueloId: 'v1', codigoVuelo: 'RA100', origen: 'UIO', destino: 'GYE', salida: '2026-11-06T13:00:00.000Z', estado: 'SCHEDULED' }],
  pasajeros: [
    {
      passengerId: `${bookingId}-p`,
      travellerId: 'trav-1',
      nombre: 'Ana Pérez',
      tipoDocumento: 'NATIONAL_ID',
      documento: '*******065',
      asientos: [{ vueloId: 'v1', asiento: '12A' }],
      checkIn: false,
    },
  ],
  billetes: 1,
});
const items = [reserva('b1', 'ABC123', 'SOCIO'), reserva('b2', 'DEF456', 'DIRECTO')];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminReservationsPage />
    </QueryClientProvider>,
  );
}

describe('AdminReservationsPage', () => {
  beforeEach(() => {
    mocked.mockReset();
    mocked.mockImplementation((async (url: string, options?: { method?: string }) => {
      if (url.endsWith('/check-in')) return { bookingId: 'b1', status: 'COMPLETED', checkedInPassengers: [{}] };
      if (url.endsWith('/cotizacion-cancelacion')) {
        return { quoteId: 'q-1', isRefundable: true, refundAmount: '315.00', penaltyAmount: '35.00', currency: 'USD', expiresAt: '2026-11-05T11:00:00.000Z' };
      }
      if (url.endsWith('/cancelar') && options?.method === 'POST') return { bookingId: 'b1', status: 'CANCELLED', refundAmount: '315.00', penaltyAmount: '35.00', currency: 'USD' };
      if (url.startsWith('admin/reservas/b1')) return { ...items[0], cambios: [{ en: '2026-11-05T10:05:00.000Z', descripcion: 'Emitida' }] };
      return { items, total: 2, pagina: 1, limite: 20 };
    }) as never);
  });
  afterEach(cleanup);

  it('lists channel, partner order, amount, payment reference and seats', async () => {
    renderPage();
    await screen.findByText('ABC123');
    const table = screen.getByRole('table', { name: /Reservas/ });
    expect(within(table).getAllByText('ORD-BKP-20261104-000123').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('PAY-BKP-20261104-000123').length).toBe(2);
    expect(within(table).getAllByText(/RA100 · 12A/).length).toBe(2);
    expect(within(table).getAllByText('$350.00').length).toBe(2);
    expect(mocked.mock.calls[0][0]).toBe('admin/reservas?pagina=1&limite=20');
  });

  it('marks the same traveller across two bookings', async () => {
    renderPage();
    await screen.findByText('ABC123');
    expect(screen.getByRole('status').textContent).toMatch(/Mismo pasajero/);
    expect(screen.getAllByText('Mismo pasajero').length).toBe(2);
  });

  it('sends the document search with type and nationality', async () => {
    renderPage();
    await screen.findByRole('table', { name: /Reservas/ });
    fireEvent.change(screen.getByLabelText('Documento del pasajero'), { target: { value: '1710034065' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(mocked.mock.calls.some(([u]) => String(u).startsWith('admin/reservas?documento=1710034065&tipoDocumento=NATIONAL_ID&nacionalidad=EC'))).toBe(true));
  });

  it('shows an empty state', async () => {
    mocked.mockResolvedValue({ items: [], total: 0, pagina: 1, limite: 20 } as never);
    renderPage();
    expect(await screen.findByText('No hay reservas con estos filtros.')).toBeTruthy();
  });

  it('quotes, then cancels with the quote id and a fresh Idempotency-Key', async () => {
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Ver la reserva ABC123' }))[0]);
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('Emitida', { exact: false });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cotizar cancelación' }));
    await within(dialog).findByText('Reembolsable');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar reserva' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Sí, cancelar reserva' }));
    await within(dialog).findByText(/Reserva cancelada/);
    const call = mocked.mock.calls.find(([u]) => u === 'admin/reservas/b1/cancelar');
    expect(call).toBeTruthy();
    const options = call?.[1] as { body: string; idempotencyKey: string };
    expect(JSON.parse(options.body)).toEqual({ quoteId: 'q-1', reasonCode: 'CUSTOMER_REQUEST' });
    expect(options.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('explains the 48 h check-in window on a 409', async () => {
    const base = mocked.getMockImplementation()!;
    mocked.mockImplementation((async (url: string, options?: unknown) => {
      if (url.endsWith('/check-in')) throw new ProblemDetailsError({ status: 409, code: 'CHECK_IN_NOT_AVAILABLE' });
      return base(url, options as never);
    }) as never);
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Ver la reserva ABC123' }))[0]);
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('Emitida', { exact: false });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hacer check-in' }));
    expect((await within(dialog).findByRole('alert')).textContent).toMatch(/48 horas/);
  });
});
