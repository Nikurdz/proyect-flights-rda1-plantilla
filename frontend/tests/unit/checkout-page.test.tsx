// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const offerHook = vi.hoisted(() => ({ useOferta: vi.fn() }));
vi.mock('../../src/api/endpoints/offers', () => ({ useOferta: offerHook.useOferta }));

// The steps are tested on their own: here each one is a button that completes it.
vi.mock('../../src/features/checkout/PassengerForm', () => ({
  PassengerForm: ({ oferta, onSuccess }: { oferta: unknown; onSuccess: (o: unknown) => void }) => (
    <button type="button" onClick={() => onSuccess(oferta)}>
      Guardar pasajeros
    </button>
  ),
}));
vi.mock('../../src/features/checkout/BillingForm', () => ({
  BillingForm: ({ oferta, onSuccess }: { oferta: unknown; onSuccess: (o: unknown) => void }) => (
    <button type="button" onClick={() => onSuccess(oferta)}>
      Guardar facturación
    </button>
  ),
}));
vi.mock('../../src/features/checkout/ConditionsForm', () => ({
  ConditionsForm: () => <p>Paso de condiciones</p>,
}));
vi.mock('../../src/features/checkout/PaymentForm', () => ({
  PaymentForm: () => <p>Paso de pago</p>,
}));

import { CheckoutPage } from '../../src/features/checkout/CheckoutPage';

const oferta = (over: Record<string, unknown> = {}) => ({
  ofertaId: 'o1',
  estado: 'ABIERTA',
  mercado: 'ec',
  moneda: 'USD',
  trayectos: [
    { itinerarioId: 'i1', numeroVuelo: 'RA100', origen: 'UIO', destino: 'GYE', salida: '2999-12-01T12:00:00.000Z', llegada: '2999-12-01T12:50:00.000Z', familia: 'LIGHT', total: { moneda: 'USD', monto: '86.00' } },
  ],
  pasajeros: { adultos: 2, jovenes: 0, ninos: 1, infantes: 0 },
  total: { moneda: 'USD', monto: '258.00' },
  venceEn: new Date(Date.now() + 15 * 60_000).toISOString(),
  segundosRestantes: 900,
  faltantes: [],
  ...over,
});

const Where: React.FC = () => {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/checkout/o1']}>
      <Routes>
        <Route path="/checkout/:offerId" element={<CheckoutPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

const setOffer = (data: unknown, extra: Record<string, unknown> = {}) =>
  offerHook.useOferta.mockReturnValue({ data, isLoading: false, error: null, refetch: vi.fn(), ...extra });

beforeEach(() => {
  window.scrollTo = vi.fn() as never;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CheckoutPage', () => {
  it('moves the focus to the heading of the new step and announces it', () => {
    setOffer(oferta());
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Pasajeros y contacto' })).toBeTruthy();
    // Not on the first render: the page is not yanked away from wherever the person was.
    expect(document.activeElement).toBe(document.body);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar pasajeros' }));
    const heading = screen.getByRole('heading', { level: 1, name: 'Datos de facturación' });
    expect(document.activeElement).toBe(heading);
    const progress = () => within(screen.getByRole('navigation', { name: 'Progreso de tu compra' })).getByRole('status').textContent;
    expect(progress()).toBe('Paso 2 de 4: Facturación');

    fireEvent.click(screen.getByRole('button', { name: 'Guardar facturación' }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Condiciones del viaje' }));
    expect(progress()).toBe('Paso 3 de 4: Condiciones');
  });

  it('names the payment step "Pago" and shows the total of the whole group', () => {
    setOffer(oferta());
    renderPage();
    const steps = within(screen.getByRole('navigation', { name: 'Progreso de tu compra' }));
    expect(steps.getByText('Pasajeros')).toBeTruthy();
    expect(steps.getByText('Pago')).toBeTruthy();
    expect(screen.queryByText(/Pago Seguro/)).toBeNull();
    const summary = screen.getByRole('complementary', { name: 'Resumen de tu compra' });
    expect(within(summary).getByText('Total del grupo')).toBeTruthy();
    expect(within(summary).getByText('$258.00')).toBeTruthy();
    expect(within(summary).getByText(/2 adultos, 1 niño/)).toBeTruthy();
  });

  it('asks before leaving while the seats are held, and goes back to the same search', () => {
    setOffer(oferta());
    renderPage();
    fireEvent.click(screen.getByRole('link', { name: 'Volver a resultados' }));

    const dialog = screen.getByRole('dialog', { name: '¿Salir de la compra?' });
    expect(within(dialog).getByText(/Tu cupo sigue retenido hasta \d{2}:\d{2}\. ¿Salir\?/)).toBeTruthy();
    expect(screen.queryByTestId('where')).toBeNull(); // still on the checkout

    fireEvent.click(within(dialog).getByRole('button', { name: 'Seguir comprando' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('link', { name: 'Volver a resultados' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salir' }));
    const where = screen.getByTestId('where').textContent ?? '';
    expect(where.startsWith('/resultados?')).toBe(true);
    const query = new URLSearchParams(where.split('?')[1]);
    expect(query.get('origin')).toBe('UIO');
    expect(query.get('destination')).toBe('GYE');
    expect(query.get('outbound')).toBe('2999-12-01');
    expect(query.get('trip')).toBe('OW');
    expect(query.get('adt')).toBe('2');
    expect(query.get('chd')).toBe('1');
  });

  it('shows an empty state with a way out when the offer does not load, never a blank page', () => {
    setOffer(undefined);
    renderPage();
    expect(screen.getByRole('heading', { name: 'No encontramos tu reserva' })).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Buscar vuelos' });
    expect(link.getAttribute('href')).toBe('/');
  });

  it('shows the error with a retry (and no empty state) when the request fails', () => {
    setOffer(undefined, { error: new Error('boom') });
    renderPage();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'No encontramos tu reserva' })).toBeNull();
  });

  it('offers to repeat the search when the hold ran out, without asking to confirm', () => {
    setOffer(oferta({ estado: 'VENCIDA' }));
    renderPage();
    expect(screen.getByRole('heading', { name: 'Se acabó el tiempo de tu reserva' })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Volver a resultados' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((screen.getByTestId('where').textContent ?? '').startsWith('/resultados?')).toBe(true);
  });
});
