// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../src/components/ui/Toast';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/client', () => ({ apiClient: vi.fn() }));
vi.mock('../../src/lib/session', () => ({ useSession: () => ({ ownerId: 'me-1' }) }));

import { apiClient } from '../../src/api/client';
import { ProblemDetailsError } from '../../src/api/problem-details';
import { AdminAirportsPage } from '../../src/features/admin/AdminAirportsPage';

const mocked = vi.mocked(apiClient);

const airport = (over: Record<string, unknown>) => ({
  iata: 'UIO',
  ciudad: 'Quito',
  nombre: 'Mariscal Sucre',
  pais: 'EC',
  paisNombre: 'Ecuador',
  zonaHoraria: 'America/Guayaquil',
  vuelos: 4,
  ...over,
});

const page = { items: [airport({}), airport({ iata: 'LOH', ciudad: 'Loja', nombre: 'Camilo Ponce', vuelos: 0 })], total: 2, pagina: 1, limite: 25 };

let client: QueryClient;

function renderPage() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
      <MemoryRouter>
      <AdminAirportsPage />
    </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const posts = () => mocked.mock.calls.filter(([, o]) => (o as { method?: string } | undefined)?.method === 'POST');

async function fillAndReview(iata = 'tul', zona?: string) {
  fireEvent.click(await screen.findByRole('button', { name: /Nuevo aeropuerto/ }));
  const dialog = await screen.findByRole('dialog');
  const type = (label: string, value: string) => fireEvent.change(within(dialog).getByLabelText(new RegExp(label)), { target: { value } });
  type('Código IATA', iata);
  type('Ciudad', 'Tulcán');
  type('Nombre del aeropuerto', 'Teniente Coronel Luis a Mantilla');
  if (zona) type('Zona horaria', zona);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Revisar y continuar' }));
}

describe('AdminAirportsPage', () => {
  beforeEach(() => {
    mocked.mockReset();
    mocked.mockResolvedValue(page as never);
  });
  afterEach(cleanup);

  it('lists airports and searches with the debounced query', async () => {
    renderPage();
    expect(await screen.findByText('Loja')).toBeTruthy();
    expect(String(mocked.mock.calls[0][0])).toContain('admin/aeropuertos?pagina=1&limite=25');
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'loja' } });
    await waitFor(() => expect(mocked.mock.calls.some(([u]) => String(u).includes('q=loja'))).toBe(true));
  });

  it('shows the empty state', async () => {
    mocked.mockResolvedValue({ items: [], total: 0, pagina: 1, limite: 25 } as never);
    renderPage();
    expect(await screen.findByText('No hay aeropuertos con estos filtros')).toBeTruthy();
  });

  it('validates the form on the client and sends nothing', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Nuevo aeropuerto/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Revisar y continuar' }));
    expect(await screen.findByText(/exactamente 3 letras/)).toBeTruthy();
    expect(screen.getByText('Ingresa la ciudad.')).toBeTruthy();
    expect(posts()).toHaveLength(0);
  });

  it('rejects a time zone that is not IANA', async () => {
    renderPage();
    await fillAndReview('tul', 'Mars/Olympus');
    expect(await screen.findByText(/No es una zona IANA válida/)).toBeTruthy();
    expect(posts()).toHaveLength(0);
  });

  it('asks for confirmation first and posts confirmar: true only after confirming, then invalidates the catalogue', async () => {
    renderPage();
    await screen.findByText('Loja');
    const spy = vi.spyOn(client, 'invalidateQueries');
    await fillAndReview();
    const confirm = await screen.findByRole('dialog', { name: 'Confirmar nuevo aeropuerto' });
    expect(within(confirm).getByText('TUL')).toBeTruthy();
    expect(within(confirm).getByText(/no se podrá borrar ni editar/)).toBeTruthy();
    expect(posts()).toHaveLength(0);

    mocked.mockResolvedValue(airport({ iata: 'TUL', ciudad: 'Tulcán', vuelos: 0 }) as never);
    fireEvent.click(within(confirm).getByRole('button', { name: 'Crear aeropuerto' }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    const [url, options] = posts()[0];
    expect(String(url)).toBe('admin/aeropuertos');
    expect(JSON.parse((options as { body: string }).body)).toEqual({
      iata: 'TUL',
      ciudad: 'Tulcán',
      nombre: 'Teniente Coronel Luis a Mantilla',
      pais: 'EC',
      paisNombre: 'Ecuador',
      zonaHoraria: 'America/Guayaquil',
      confirmar: true,
    });
    expect(await screen.findByText(/Aeropuerto TUL creado/)).toBeTruthy();
    const keys = spy.mock.calls.map(([f]) => JSON.stringify((f as { queryKey: unknown }).queryKey));
    expect(keys).toContain(JSON.stringify(['localidades']));
    expect(keys).toContain(JSON.stringify(['admin-aeropuertos']));
  });

  it.each([
    [409, [], /Ya existe un aeropuerto con ese código/],
    [422, [], /Falta la confirmación/],
    [400, [{ name: 'zonaHoraria', reason: 'inválida' }], /zona horaria/],
  ])('shows a clear message for a %i answer inside the confirmation', async (status, invalidParams, text) => {
    renderPage();
    await screen.findByText('Loja');
    await fillAndReview();
    const confirm = await screen.findByRole('dialog', { name: 'Confirmar nuevo aeropuerto' });
    mocked.mockRejectedValue(new ProblemDetailsError({ status, invalidParams } as never));
    fireEvent.click(within(confirm).getByRole('button', { name: 'Crear aeropuerto' }));
    expect(await screen.findByText(text)).toBeTruthy();
  });
});
