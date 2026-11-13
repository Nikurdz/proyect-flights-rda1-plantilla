// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/client', () => ({ apiClient: vi.fn() }));

import { apiClient } from '../../src/api/client';
import { ProblemDetailsError } from '../../src/api/problem-details';
import { BillingForm } from '../../src/features/checkout/BillingForm';
import { ConditionsForm } from '../../src/features/checkout/ConditionsForm';
import { CardFieldset } from '../../src/features/experiences/CardFieldset';
import { useCardForm } from '../../src/hooks/useCardForm';
import { holdUntil, passengerTitle, resultsPathFromOffer } from '../../src/lib/checkout';
import type { OfertaViewDto } from '../../src/api/types';

const mocked = vi.mocked(apiClient);

const oferta = {
  ofertaId: 'o1',
  estado: 'ABIERTA',
  mercado: 'ec',
  moneda: 'USD',
  trayectos: [
    { itinerarioId: 'i1', numeroVuelo: 'RA100', origen: 'UIO', destino: 'GYE', salida: '2999-12-01T12:00:00.000Z', llegada: '2999-12-01T12:50:00.000Z', familia: 'LIGHT', total: { moneda: 'USD', monto: '86.00' } },
    { itinerarioId: 'i2', numeroVuelo: 'RA101', origen: 'GYE', destino: 'UIO', salida: '2999-12-05T23:30:00.000Z', llegada: '2999-12-06T00:20:00.000Z', familia: 'LIGHT', total: { moneda: 'USD', monto: '86.00' } },
  ],
  pasajeros: { adultos: 2, jovenes: 1, ninos: 0, infantes: 1 },
  total: { moneda: 'USD', monto: '258.00' },
  venceEn: '2999-12-01T15:35:00.000Z',
  segundosRestantes: 900,
  faltantes: [],
} as unknown as OfertaViewDto;

const mercado = {
  pais: 'EC',
  identificacionesFiscales: [
    { tipo: 'CEDULA', etiqueta: 'Cédula de identidad', patron: '' },
    { tipo: 'RUC', etiqueta: 'RUC', patron: '' },
    { tipo: 'PASAPORTE', etiqueta: 'Pasaporte', patron: '' },
  ],
  textosLegales: { terminos: { version: '3' }, condicionesTransporte: { version: '2' } },
};

let marketAnswer: () => unknown;

beforeEach(() => {
  marketAnswer = () => mercado;
  mocked.mockReset();
  mocked.mockImplementation((async (url: string) => {
    if (url === 'mercados/ec') return marketAnswer();
    return {};
  }) as never);
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const wrap = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('checkout helpers', () => {
  it('rebuilds the search (route, dates in Ecuador, passengers) from the offer', () => {
    const [path, query] = resultsPathFromOffer(oferta).split('?');
    expect(path).toBe('/resultados');
    const params = new URLSearchParams(query);
    expect(Object.fromEntries(params)).toMatchObject({ origin: 'UIO', destination: 'GYE', outbound: '2999-12-01', inbound: '2999-12-05', trip: 'RT', adt: '2', yth: '1', inf: '1' });
  });

  it('falls back to the home page without legs, and names passengers in words', () => {
    expect(resultsPathFromOffer(undefined)).toBe('/');
    expect(passengerTitle(1, 'ADULT')).toBe('Pasajero 1 · Adulto');
    expect(passengerTitle(3, 'CHILD')).toBe('Pasajero 3 · Niño');
    expect(holdUntil(oferta)).toBe('10:35');
  });
});

describe('BillingForm', () => {
  it('copies the name and document of passenger 1 with one button', async () => {
    wrap(<BillingForm oferta={oferta} titular={{ nombres: 'Ana', apellidos: 'Paz', documento: { tipo: 'NATIONAL_ID', numero: '1712345678' } }} onSuccess={vi.fn()} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Usar datos del pasajero 1' }));
    await waitFor(() => expect((screen.getByLabelText('Nombre o razón social') as HTMLInputElement).value).toBe('Ana Paz'));
    expect((screen.getByLabelText('Cédula, RUC o pasaporte') as HTMLInputElement).value).toBe('1712345678');
    expect((screen.getByLabelText('Tipo de documento') as HTMLSelectElement).value).toBe('CEDULA');
  });

  it('maps a passport to the passport type and keeps the country to the market (Ecuador)', async () => {
    wrap(<BillingForm oferta={oferta} titular={{ nombres: 'Ana', apellidos: 'Paz', documento: { tipo: 'PASSPORT', numero: 'AB123456' } }} onSuccess={vi.fn()} onBack={vi.fn()} />);
    await screen.findByRole('option', { name: 'Pasaporte' });
    fireEvent.click(screen.getByRole('button', { name: 'Usar datos del pasajero 1' }));
    await waitFor(() => expect((screen.getByLabelText('Tipo de documento') as HTMLSelectElement).value).toBe('PASAPORTE'));
    const country = screen.getByLabelText('País') as HTMLSelectElement;
    expect(Array.from(country.options).map((o) => o.textContent)).toEqual(['Ecuador']);
    expect(screen.queryByText(/NIT/)).toBeNull();
  });

  it('has no shortcut when nobody is known yet', () => {
    wrap(<BillingForm oferta={oferta} onSuccess={vi.fn()} onBack={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Usar datos del pasajero 1' })).toBeNull();
  });
});

describe('ConditionsForm', () => {
  it('says why "Continuar al pago" is disabled and links the reason to the button', async () => {
    wrap(<ConditionsForm oferta={oferta} onSuccess={vi.fn()} onBack={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Continuar al pago' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const reason = screen.getByText('Marca las 3 casillas para continuar.');
    expect(button.getAttribute('aria-describedby')).toBe(reason.id);

    await screen.findByText(/Versión del texto: 3/);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Acepto los términos y condiciones generales' }));
    expect(screen.getByText('Faltan 2 casillas por marcar para continuar.')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Acepto las condiciones del contrato de transporte aéreo' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Confirmo que mis datos son verídicos' }));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Continuar al pago' }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByText(/para continuar\./)).toBeNull();
  });

  it('keeps the version out of the checkbox name', async () => {
    wrap(<ConditionsForm oferta={oferta} onSuccess={vi.fn()} onBack={vi.fn()} />);
    await screen.findByText(/Versión del texto: 2/);
    expect(screen.queryByRole('checkbox', { name: /versión/i })).toBeNull();
  });

  it('shows an error with a retry when the legal texts of the market cannot be read', async () => {
    marketAnswer = () => {
      throw new ProblemDetailsError({ status: 503, code: 'SERVICE_UNAVAILABLE' });
    };
    wrap(<ConditionsForm oferta={oferta} onSuccess={vi.fn()} onBack={vi.fn()} />);
    expect(await screen.findByText('No pudimos cargar las condiciones')).toBeTruthy();

    marketAnswer = () => mercado;
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText(/Versión del texto: 3/);
  });
});

const CardDemo: React.FC = () => {
  const card = useCardForm();
  return <CardFieldset card={card} idPrefix="card" />;
};

describe('Card fields of the simulated payment', () => {
  it('shows one clear notice and no "Pago Seguro" or encryption claims', () => {
    vi.stubEnv('VITE_SHOW_TEST_CARDS', 'true');
    render(<CardDemo />);
    expect(screen.getByText('Pago de prueba: no se cobra ni se guardan los datos de tu tarjeta.')).toBeTruthy();
    expect(screen.queryByText(/Pago Seguro|cifrad|prototipo/i)).toBeNull();
  });

  it('offers the approved and the failing test cards only when the flag is on', () => {
    vi.stubEnv('VITE_SHOW_TEST_CARDS', 'false');
    const { unmount } = render(<CardDemo />);
    expect(screen.queryByRole('button', { name: 'Ver tarjetas de prueba' })).toBeNull();
    unmount();

    vi.stubEnv('VITE_SHOW_TEST_CARDS', 'true');
    render(<CardDemo />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarjetas de prueba' }));
    expect(screen.getByText(/4111 1111 1111 1111/)).toBeTruthy();
    expect(screen.getByText('Rechazada por el banco')).toBeTruthy();
  });
});
