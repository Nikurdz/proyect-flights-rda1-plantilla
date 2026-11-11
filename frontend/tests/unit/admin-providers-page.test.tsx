// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/client', () => ({ apiClient: vi.fn() }));
vi.mock('../../src/lib/session', () => ({ useSession: () => ({ ownerId: 'admin-1' }) }));

import { apiClient } from '../../src/api/client';
import { ProblemDetailsError } from '../../src/api/problem-details';
import { AdminProvidersPage } from '../../src/features/admin/AdminProvidersPage';

const mocked = vi.mocked(apiClient);

const salud = (estado: string, latenciaMs: number | null = 90) => ({ estado, latenciaMs, detalle: null, comprobadoEn: new Date().toISOString() });
const proveedor = (over: Record<string, unknown>) => ({
  id: 'x',
  nombre: 'X',
  equipo: 'Equipo',
  baseUrl: 'https://x.example.com/api/v2',
  tipoServicio: 'ATRACCIONES',
  activo: true,
  salud: salud('UP'),
  circuito: 'CERRADO',
  productos: 5,
  ...over,
});

const lista = [
  proveedor({ id: 'p-up', nombre: 'Atracciones Quito', salud: salud('UP', 120), productos: 14 }),
  proveedor({ id: 'p-down', nombre: 'Autos Sur', tipoServicio: 'AUTOS', salud: salud('DOWN', null), circuito: 'ABIERTO', productos: 0 }),
  proveedor({ id: 'p-off', nombre: 'Hotel Norte', tipoServicio: 'ALOJAMIENTOS', activo: false, salud: salud('APAGADO', null) }),
];

function routes(handler?: (url: string, init?: RequestInit) => unknown) {
  mocked.mockImplementation((async (url: string, init?: RequestInit) => {
    const custom = handler?.(url, init);
    if (custom !== undefined) return custom;
    if (url === 'admin/proveedores' && !init?.method) return lista;
    return {};
  }) as never);
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminProvidersPage />
    </QueryClientProvider>,
  );
}

const callsTo = (fragment: string, method?: string) => mocked.mock.calls.filter(([url, init]) => String(url).includes(fragment) && (!method || (init as RequestInit | undefined)?.method === method));
const card = (nombre: string) => screen.getByRole('article', { name: nombre });

describe('AdminProvidersPage', () => {
  beforeEach(() => {
    mocked.mockReset();
    routes();
  });
  afterEach(cleanup);

  it('shows the traffic light as text, latency, circuit and products for each provider', async () => {
    renderPage();
    const up = await screen.findByRole('article', { name: 'Atracciones Quito' });
    expect(within(up).getByText('En línea')).toBeTruthy();
    expect(within(up).getByText('120 ms')).toBeTruthy();
    expect(within(up).getByText('Circuito cerrado')).toBeTruthy();
    expect(within(up).getByText('14')).toBeTruthy();

    const down = card('Autos Sur');
    expect(within(down).getByText('Caído')).toBeTruthy();
    expect(within(down).getByText('Circuito abierto')).toBeTruthy();
    expect(within(down).getByRole('switch').getAttribute('aria-checked')).toBe('true');

    const off = card('Hotel Norte');
    expect(within(off).getByText('Apagado', { selector: 'span.text-xs.font-bold' })).toBeTruthy();
    expect((within(off).getByRole('button', { name: /Comprobar/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(screen.getByRole('group', { name: 'Resumen de proveedores' })).getByText('Caídos').nextSibling?.textContent).toBe('1');
  });

  it('only offers synchronisation for attraction providers', async () => {
    renderPage();
    await screen.findByRole('article', { name: 'Atracciones Quito' });
    expect((within(card('Atracciones Quito')).getByRole('button', { name: /Sincronizar/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((within(card('Autos Sur')).getByRole('button', { name: /Sincronizar/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(card('Autos Sur')).getByText(/solo está disponible para proveedores de Atracciones/)).toBeTruthy();
  });

  it('checks a provider now and shows the result', async () => {
    routes((url, init) => (url === 'admin/proveedores/p-up/ping' && init?.method === 'POST' ? salud('DEGRADADO', 1800) : undefined));
    renderPage();
    await screen.findByRole('article', { name: 'Atracciones Quito' });
    fireEvent.click(within(card('Atracciones Quito')).getByRole('button', { name: /Comprobar/ }));
    const result = await within(card('Atracciones Quito')).findByText('Comprobación:');
    expect(result.parentElement?.textContent).toContain('Degradado');
    expect(result.parentElement?.textContent).toContain('1.800 ms');
  });

  it('shows the synchronisation result: imported, new, updated and deactivated', async () => {
    routes((url, init) => (url === 'admin/proveedores/p-up/sincronizar' && init?.method === 'POST' ? { importados: 12, nuevos: 3, actualizados: 8, desactivados: 1 } : undefined));
    renderPage();
    await screen.findByRole('article', { name: 'Atracciones Quito' });
    fireEvent.click(within(card('Atracciones Quito')).getByRole('button', { name: /Sincronizar/ }));
    expect(await screen.findByText(/12 importados: 3 nuevos, 8 actualizados y 1 desactivados/)).toBeTruthy();
  });

  it('explains a 503 from the provider when synchronising', async () => {
    routes((url, init) => {
      if (url === 'admin/proveedores/p-up/sincronizar' && init?.method === 'POST') throw new ProblemDetailsError({ status: 503, code: 'PROVIDER_UNAVAILABLE' });
      return undefined;
    });
    renderPage();
    await screen.findByRole('article', { name: 'Atracciones Quito' });
    fireEvent.click(within(card('Atracciones Quito')).getByRole('button', { name: /Sincronizar/ }));
    expect(await screen.findByText(/El proveedor no responde \(o su circuito está abierto\)/)).toBeTruthy();
  });

  it('asks for confirmation before switching a provider off, then sends activo:false', async () => {
    renderPage();
    await screen.findByRole('article', { name: 'Atracciones Quito' });
    fireEvent.click(within(card('Atracciones Quito')).getByRole('switch'));
    const dialog = await screen.findByRole('dialog');
    expect(callsTo('admin/proveedores/p-up', 'PATCH')).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apagar proveedor' }));
    await waitFor(() => expect(callsTo('admin/proveedores/p-up', 'PATCH')).toHaveLength(1));
    expect(callsTo('admin/proveedores/p-up', 'PATCH')[0][1]).toMatchObject({ body: JSON.stringify({ activo: false }) });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('switches a provider back on without asking', async () => {
    renderPage();
    await screen.findByRole('article', { name: 'Hotel Norte' });
    fireEvent.click(within(card('Hotel Norte')).getByRole('switch'));
    await waitFor(() => expect(callsTo('admin/proveedores/p-off', 'PATCH')).toHaveLength(1));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(callsTo('admin/proveedores/p-off', 'PATCH')[0][1]).toMatchObject({ body: JSON.stringify({ activo: true }) });
  });

  it('deletes after a destructive confirmation and explains PROVIDER_IN_USE', async () => {
    routes((url, init) => {
      if (url === 'admin/proveedores/p-up' && init?.method === 'DELETE') throw new ProblemDetailsError({ status: 409, code: 'PROVIDER_IN_USE' });
      return undefined;
    });
    renderPage();
    await screen.findByRole('article', { name: 'Atracciones Quito' });
    fireEvent.click(within(card('Atracciones Quito')).getByRole('button', { name: /Eliminar el proveedor/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/no se puede deshacer/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Eliminar proveedor' }));
    expect(await within(dialog).findByText(/ya vendió reservas, por eso no se puede eliminar/)).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('loads the health history only when it is opened', async () => {
    routes((url) => (url === 'admin/proveedores/p-up/salud' ? [salud('UP', 100), salud('DOWN', null)] : undefined));
    renderPage();
    await screen.findByRole('article', { name: 'Atracciones Quito' });
    expect(callsTo('/salud')).toHaveLength(0);
    const toggle = within(card('Atracciones Quito')).getByRole('button', { name: 'Historial de salud' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(await screen.findByRole('table', { name: /Historial de comprobaciones/ })).toBeTruthy();
    expect(callsTo('/salud')).toHaveLength(1);
  });

  it('validates the registration form before sending and shows server conflicts', async () => {
    renderPage();
    await screen.findByRole('article', { name: 'Atracciones Quito' });
    const form = screen.getByRole('form', { name: 'Registrar proveedor' });
    fireEvent.click(within(form).getByRole('button', { name: /Registrar/ }));
    expect(await within(form).findByText('Ingresa el nombre (mínimo 2 letras).')).toBeTruthy();
    expect(callsTo('admin/proveedores', 'POST')).toHaveLength(0);

    const type = (label: string, value: string) => fireEvent.change(within(form).getByLabelText(label), { target: { value } });
    type('Nombre', 'Atracciones Quito');
    type('Equipo', 'Equipo A');
    type('URL base', 'https://atracciones.example.com');
    routes((url, init) => {
      if (url === 'admin/proveedores' && init?.method === 'POST') throw new ProblemDetailsError({ status: 409, code: 'CONFLICT' });
      return undefined;
    });
    fireEvent.click(within(form).getByRole('button', { name: /Registrar/ }));
    expect(await screen.findByText('Ya existe un proveedor con ese nombre. Usa otro nombre.')).toBeTruthy();
    const post = callsTo('admin/proveedores', 'POST')[0];
    expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual({ nombre: 'Atracciones Quito', equipo: 'Equipo A', baseUrl: 'https://atracciones.example.com', tipoServicio: 'ATRACCIONES' });
  });

  it('re-reads the list on its own every 30 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderPage();
      await screen.findByRole('article', { name: 'Atracciones Quito' });
      const before = callsTo('admin/proveedores').filter(([url]) => url === 'admin/proveedores').length;
      await vi.advanceTimersByTimeAsync(31_000);
      await waitFor(() => expect(callsTo('admin/proveedores').filter(([url]) => url === 'admin/proveedores').length).toBeGreaterThan(before));
    } finally {
      vi.useRealTimers();
    }
  });
});
