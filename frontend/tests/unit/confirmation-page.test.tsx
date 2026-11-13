// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/client', () => ({ apiClient: vi.fn() }));

import { ToastProvider } from '../../src/components/ui/Toast';
import { ConfirmationPage } from '../../src/features/confirmation/ConfirmationPage';
import { PriceChangedModal } from '../../src/features/checkout/PriceChangedModal';

const orden = {
  ordenId: 'ord-1',
  numeroOrden: 'ORD-7K3M9PQ2XA',
  pnr: 'K7M2QX',
  estado: 'EMITIDA',
  mercado: 'ec',
  total: { moneda: 'USD', monto: '172.00' },
  itinerarios: [
    { numeroVuelo: 'RA100', origen: 'UIO', destino: 'GYE', salida: '2999-12-01T12:00:00.000Z', llegada: '2999-12-01T12:50:00.000Z', familia: 'LIGHT' },
    { numeroVuelo: 'RA101', origen: 'GYE', destino: 'UIO', salida: '2999-12-05T23:30:00.000Z', llegada: '2999-12-06T00:20:00.000Z', familia: 'LIGHT' },
  ],
  pasajeros: [{ id: 'ADT-1', tipo: 'ADULT', nombres: 'Ana', apellidos: 'Paz', eTicket: '1234567890123', asientos: [{ numeroVuelo: 'RA100', asiento: '12A' }] }],
  contacto: { correo: 'ana@example.com' },
  creadaEn: '2026-11-10T15:00:00.000Z',
  historial: [],
};

afterEach(cleanup);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[{ pathname: '/confirmacion/ORD-7K3M9PQ2XA', state: { orden } }]}>
          <Routes>
            <Route path="/confirmacion/:orderNumber" element={<ConfirmationPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('ConfirmationPage', () => {
  it('shows one boarding pass per leg with the locator on the stub and a clear status', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Tu reserva está confirmada' })).toBeTruthy();
    const ida = screen.getByRole('article', { name: /Ida: vuelo RA100 de UIO a GYE/ });
    const vuelta = screen.getByRole('article', { name: /Vuelta: vuelo RA101 de GYE a UIO/ });
    for (const pass of [ida, vuelta]) {
      expect(within(pass).getByText('K7M2QX')).toBeTruthy();
      expect(within(pass).getByText('Confirmada')).toBeTruthy();
    }
    expect(screen.getByText('1234567890123')).toBeTruthy();
    expect(screen.getByText('$172.00')).toBeTruthy();
  });

  it('copies the locator and confirms with a toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Copiar código de reserva' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('K7M2QX'));
    expect(await screen.findByText('Código copiado')).toBeTruthy();
  });

  it('invites a guest to create an account and has no prototype wording', () => {
    renderPage();
    const link = screen.getByRole('link', { name: 'Crear cuenta' });
    expect(link.getAttribute('href')).toContain('/registro?');
    expect(screen.getByRole('button', { name: 'Imprimir comprobante' })).toBeTruthy();
    expect(screen.queryByText(/prototipo/i)).toBeNull();
  });
});

describe('PriceChangedModal', () => {
  it('says the price changed, shows both prices and offers two clear ways out', () => {
    const onCancel = vi.fn();
    render(
      <PriceChangedModal
        isOpen
        ofertaId="o1"
        precioAnterior={{ moneda: 'USD', monto: '86.00' }}
        precioNuevo={{ moneda: 'USD', monto: '94.50' }}
        onAccepted={vi.fn()}
        onCancel={onCancel}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'El precio cambió' });
    expect(within(dialog).getByText('$86.00')).toBeTruthy();
    expect(within(dialog).getByText('$94.50')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Pagar el nuevo precio' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Buscar otro vuelo' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
