// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../src/components/ui/Toast';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/client', () => ({ apiClient: vi.fn(), apiBlob: vi.fn(), saveBlob: vi.fn() }));
vi.mock('../../src/lib/session', () => ({ useSession: () => ({ ownerId: 'admin-1' }) }));

import { apiBlob, apiClient, saveBlob } from '../../src/api/client';
import { ProblemDetailsError } from '../../src/api/problem-details';
import { AdminBookingBillingPage } from '../../src/features/admin/AdminBookingBillingPage';
import { currentMonthRange } from '../../src/api/endpoints/facturacion-booking';

const mocked = vi.mocked(apiClient);
const blob = vi.mocked(apiBlob);

const linea = (over: Record<string, unknown> = {}) => ({
  bookingId: 'b1',
  pnr: 'ABC123',
  fecha: '2026-11-05',
  partnerOrderId: 'ORD-BKP-1',
  paymentReference: 'PAY-BKP-1',
  estado: 'CONFIRMED',
  moneda: 'USD',
  base: '100.00',
  iva: '15.00',
  ivaEsperado: '15.00',
  ivaSegunBooking: '15.00',
  diferenciaConBooking: '0.00',
  ivaAlerta: false,
  total: '115.00',
  notaCredito: null,
  equipaje: '0.00',
  cambiosFecha: { diferencias: '0.00', cargo: '0.00' },
  ...over,
});
const items = [
  linea(),
  linea({ bookingId: 'b2', pnr: 'DEF456', estado: 'CANCELLED', iva: '10.00', ivaAlerta: true, ivaSegunBooking: '15.00', notaCredito: { numero: 'NC-0001', reembolso: '100.00', penalidad: '15.00' } }),
];
const totales = { ventas: 2, base: '200.00', iva: '25.00', total: '230.00', cancelaciones: 1, reembolsos: '100.00', penalidades: '15.00', equipaje: '5.00', cambiosFecha: '3.00', neto: '138.00', alertasIva: 1 };
const resumen = { periodo: { desde: '2026-11-01', hasta: '2026-11-09', zonaHoraria: 'America/Guayaquil' }, moneda: 'USD', total: totales, dias: [{ fecha: '2026-11-05', ...totales }], truncado: false };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
      <MemoryRouter>
        <AdminBookingBillingPage />
      </MemoryRouter>
    </ToastProvider>
    </QueryClientProvider>,
  );
}

const listCalls = () => mocked.mock.calls.map(([u]) => String(u)).filter((u) => !u.includes('/resumen'));

describe('AdminBookingBillingPage', () => {
  beforeEach(() => {
    mocked.mockReset();
    blob.mockReset();
    vi.mocked(saveBlob).mockReset();
    mocked.mockImplementation((async (url: string) => {
      if (url.includes('/resumen')) return resumen;
      return { items, total: 2, pagina: 1, limite: 25 };
    }) as never);
  });
  afterEach(cleanup);

  it('defaults to the current month in Ecuador time and shows the fixed notice', async () => {
    renderPage();
    await screen.findByText('ABC123');
    const { desde, hasta } = currentMonthRange();
    expect(listCalls()[0]).toBe(`admin/facturacion-booking?desde=${desde}&hasta=${hasta}&pagina=1&limite=25`);
    expect(screen.getByText(/no es un documento fiscal/)).toBeTruthy();
  });

  it('shows amounts, the VAT alert with its detail and the credit note column', async () => {
    renderPage();
    await screen.findByText('DEF456');
    const table = screen.getByRole('table', { name: /Ventas de Booking/ });
    expect(within(table).getAllByText('$115.00').length).toBe(2);
    expect(within(table).getByText('IVA no cuadra')).toBeTruthy();
    expect(within(table).getByText(/Nuestro IVA 10.00 · 15 % de la base 15.00 · Booking \(incluido\) 15.00/)).toBeTruthy();
    expect(within(table).getByText('NC-0001')).toBeTruthy();
    expect(within(table).getByText('Reembolso 100.00')).toBeTruthy();
    expect(within(table).getByText('Penalidad 15.00')).toBeTruthy();
  });

  it('shows the period cards and the per-day table', async () => {
    renderPage();
    const cards = await screen.findByLabelText('Totales del periodo');
    await within(cards).findByText('$138.00');
    expect(within(cards).getByText('$8.00')).toBeTruthy();
    expect(screen.getByRole('table', { name: /Resumen por día/ })).toBeTruthy();
  });

  it('warns when the summary was truncated', async () => {
    mocked.mockImplementation((async (url: string) => (url.includes('/resumen') ? { ...resumen, truncado: true } : { items, total: 2, pagina: 1, limite: 25 })) as never);
    renderPage();
    expect(await screen.findByText(/primeras 5000 ventas/)).toBeTruthy();
  });

  it('sends the filters as a query', async () => {
    renderPage();
    await screen.findByText('ABC123');
    fireEvent.change(screen.getByLabelText('Socio'), { target: { value: 'booking-prototipo' } });
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'CANCELLED' } });
    fireEvent.click(screen.getByLabelText('Solo con IVA descuadrado'));
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(listCalls().some((u) => u.includes('partnerId=booking-prototipo') && u.includes('estado=CANCELLED') && u.includes('soloAlertas=true'))).toBe(true));
    await waitFor(() => expect(mocked.mock.calls.some(([u]) => String(u).startsWith('admin/facturacion-booking/resumen?') && String(u).includes('soloAlertas=true'))).toBe(true));
  });

  it('exports the CSV with the applied filters', async () => {
    blob.mockResolvedValue(new Blob(['x']));
    renderPage();
    await screen.findByText('ABC123');
    fireEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalled());
    const url = String(blob.mock.calls[0][0]);
    expect(url.startsWith('admin/facturacion-booking/export.csv?desde=')).toBe(true);
    expect(url).not.toContain('pagina');
    expect(await screen.findByText(/Descargado facturacion-booking-/)).toBeTruthy();
  });

  it('shows the problem when the export fails', async () => {
    blob.mockRejectedValue(new ProblemDetailsError({ type: 'about:blank', title: 'Bad', status: 400, code: 'VALIDATION_ERROR' } as never));
    renderPage();
    await screen.findByText('ABC123');
    fireEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
    expect(await screen.findByText(/Algún filtro no es válido/)).toBeTruthy();
  });

  it('shows the empty state and the error with retry', async () => {
    mocked.mockImplementation((async (url: string) => {
      if (url.includes('/resumen')) return resumen;
      return { items: [], total: 0, pagina: 1, limite: 25 };
    }) as never);
    renderPage();
    expect(await screen.findByText('No hay ventas de Booking con estos filtros')).toBeTruthy();
    cleanup();
    mocked.mockReset();
    mocked.mockRejectedValue(new ProblemDetailsError({ type: 'about:blank', title: 'Boom', status: 500, code: 'INTERNAL_ERROR' } as never));
    renderPage();
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0);
  });
});
