// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/client', () => ({ apiClient: vi.fn() }));
vi.mock('../../src/lib/session', () => ({ useSession: () => ({ ownerId: 'admin-1' }) }));

import { apiClient } from '../../src/api/client';
import { AdminInvoicesPage } from '../../src/features/admin/AdminInvoicesPage';

const mocked = vi.mocked(apiClient);
const usd = (monto: string) => ({ moneda: 'USD', monto });

const items = [
  { numeroFactura: 'FAC-AAAAAAAAAA', estado: 'EMITIDA', emitidaEn: '2026-10-25T10:00:00.000Z', origen: 'ORDEN', referencia: 'ord-1', subtotal: usd('100.00'), iva: usd('15.00'), total: usd('115.00') },
  { numeroFactura: 'FAC-BBBBBBBBBB', estado: 'ANULADA', emitidaEn: '2026-10-24T10:00:00.000Z', origen: 'EXPERIENCIA', referencia: 'res-1', subtotal: usd('20.00'), iva: usd('3.00'), total: usd('23.00') },
];
const detalle = {
  ...items[0],
  detalles: [
    { linea: 1, tipo: 'TARIFA', concepto: 'BOG-SCL adulto', cantidad: 2, precioUnitario: usd('50.00'), iva: usd('15.00'), total: usd('115.00') },
  ],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminInvoicesPage />
    </QueryClientProvider>,
  );
}

describe('AdminInvoicesPage', () => {
  beforeEach(() => {
    mocked.mockReset();
    mocked.mockImplementation((async (url: string) => {
      if (url.startsWith('admin/facturas/FAC-')) return detalle;
      return { items, totalEmitido: usd('115.00') };
    }) as never);
  });
  afterEach(cleanup);

  it('lists invoices with the issued total, state and origin', async () => {
    renderPage();
    expect(await screen.findByText('FAC-AAAAAAAAAA')).toBeTruthy();
    expect(screen.getByText('Total emitido').nextElementSibling?.textContent).toBe('$115.00');
    const table = screen.getByRole('table', { name: /Facturas/ });
    expect(within(table).getByText('Anulada')).toBeTruthy();
    expect(within(table).getByText('Experiencia')).toBeTruthy();
    expect(within(table).getByText('Vuelo')).toBeTruthy();
    expect(mocked.mock.calls[0][0]).toBe('admin/facturas?limite=50');
  });

  it('sends the state and origin filters', async () => {
    renderPage();
    await screen.findByText('FAC-AAAAAAAAAA');
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'ANULADA' } });
    fireEvent.change(screen.getByLabelText('Origen'), { target: { value: 'EXPERIENCIA' } });
    await waitFor(() => expect(mocked.mock.calls.some(([u]) => u === 'admin/facturas?estado=ANULADA&origen=EXPERIENCIA&limite=50')).toBe(true));
  });

  it('opens the detail with its lines, VAT and totals', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver el detalle de la factura FAC-AAAAAAAAAA' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('BOG-SCL adulto')).toBeTruthy();
    expect(within(dialog).getByText('Subtotal').nextElementSibling?.textContent).toBe('$100.00');
    expect(within(dialog).getByText('IVA', { selector: 'dt' }).nextElementSibling?.textContent).toBe('$15.00');
    expect(within(dialog).getByText('Total', { selector: 'dt' }).nextElementSibling?.textContent).toBe('$115.00');
    expect(mocked.mock.calls.some(([u]) => u === 'admin/facturas/FAC-AAAAAAAAAA')).toBe(true);
  });

  it('shows an empty state', async () => {
    mocked.mockResolvedValue({ items: [], totalEmitido: usd('0.00') } as never);
    renderPage();
    expect(await screen.findByText('No hay facturas con estos filtros.')).toBeTruthy();
  });
});
