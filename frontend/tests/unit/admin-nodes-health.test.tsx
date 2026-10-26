// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/client', () => ({ apiClient: vi.fn() }));
vi.mock('../../src/lib/session', () => ({ useSession: () => ({ ownerId: 'admin-1' }) }));

import { apiClient } from '../../src/api/client';
import { AdminNodesHealthPage } from '../../src/features/admin/AdminNodesHealthPage';
import { AdminDashboardPage } from '../../src/features/admin/AdminDashboardPage';

const mocked = vi.mocked(apiClient);
const salud = (estado: string, latenciaMs: number | null, minute: number) => ({ estado, latenciaMs, detalle: null, comprobadoEn: `2026-10-25T10:0${minute}:00.000Z` });
const nodo = (over: Record<string, unknown>) => ({
  id: 'x',
  nombre: 'X',
  equipo: 'Eq',
  baseUrl: 'https://x.example.com',
  tipoServicio: 'ATRACCIONES',
  activo: true,
  salud: salud('UP', 100, 0),
  circuito: 'CERRADO',
  productos: 1,
  ...over,
});

const nodos = [
  nodo({ id: 'n1', nombre: 'Atracciones Quito', salud: salud('UP', 120, 5) }),
  nodo({ id: 'n2', nombre: 'Autos Sur', tipoServicio: 'AUTOS', salud: salud('DOWN', null, 4), circuito: 'ABIERTO' }),
];
const historial: Record<string, unknown[]> = {
  n1: [salud('UP', 120, 5), salud('DEGRADADO', 900, 3), salud('UP', 80, 1)],
  n2: [salud('DOWN', null, 4)],
};

function renderIn(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminNodesHealthPage', () => {
  beforeEach(() => {
    mocked.mockReset();
    mocked.mockImplementation((async (url: string) => {
      if (url === 'admin/proveedores') return nodos;
      const m = /^admin\/proveedores\/(\w+)\/salud$/.exec(url);
      return m ? historial[m[1]] : {};
    }) as never);
  });
  afterEach(cleanup);

  it('shows every node with its state and circuit, and the summary tiles', async () => {
    renderIn(<AdminNodesHealthPage />);
    const table = await screen.findByRole('table', { name: /Estado de cada nodo/ });
    expect(within(table).getByText('Atracciones Quito')).toBeTruthy();
    expect(within(table).getByText('En línea')).toBeTruthy();
    expect(within(table).getByText('Caído')).toBeTruthy();
    expect(within(table).getByText('Circuito abierto')).toBeTruthy();
    const summary = screen.getByRole('group', { name: 'Resumen de nodos' });
    expect(within(summary).getByText('Caídos').nextSibling?.textContent).toBe('1');
    expect(within(summary).getByText('Circuitos abiertos').nextSibling?.textContent).toBe('1');
  });

  it('draws the latency history of the first node and switches to the chosen one', async () => {
    renderIn(<AdminNodesHealthPage />);
    const chart = await screen.findByRole('img', { name: /Latencia de Atracciones Quito/ });
    expect(chart.getAttribute('aria-label')).toMatch(/3 comprobaciones.*mínima 80 ms.*máxima 900 ms/);
    expect(chart.querySelectorAll('circle')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Ver el histórico de latencia de Autos Sur' }));
    // The down node has no measured latency: the chart says so instead of drawing nothing.
    expect(await screen.findByText(/Todavía no hay comprobaciones con latencia/)).toBeTruthy();
    await waitFor(() => expect(mocked.mock.calls.some(([u]) => u === 'admin/proveedores/n2/salud')).toBe(true));
  });
});

describe('Dashboard providers card', () => {
  const dash = {
    dias: 30,
    moneda: 'USD',
    generadoEn: '2026-10-25T12:00:00.000Z',
    desde: '2026-09-25',
    hasta: '2026-10-25',
    kpis: { ingresosMinor: 0, ordenesEmitidas: 0, ticketPromedioMinor: 0, pasajeros: 0, conversion: null, tasaCancelacion: null, reembolsosMinor: 0, ocupacionFutura: null, vuelosAgotados: 0, rechazoDePago: null },
    serie: [],
    embudo: [],
    ordenesPorEstado: {},
    pagosPorEstado: {},
    ofertasPorEstado: {},
    notificacionesPorEstado: {},
    pasajerosPorTipo: {},
    topRutas: [],
    ocupacionPorRuta: [],
    posventa: { maletasExtra: 0, ingresosEquipajeMinor: 0, cambiosDeFecha: 0, cancelaciones: 0, checkIns: 0 },
    webhooks: { entregasPendientes: 0, entregasEntregadas: 0, entregasMuertas: 0 },
  };

  beforeEach(() => {
    mocked.mockReset();
  });
  afterEach(cleanup);

  it('names the providers that are down and links to the node health view', async () => {
    mocked.mockImplementation((async (url: string) => (url.startsWith('admin/dashboard') ? dash : nodos)) as never);
    renderIn(<AdminDashboardPage />);
    const card = await screen.findByRole('region', { name: 'Proveedores' });
    expect(await within(card).findByText(/Proveedores caídos: Autos Sur/)).toBeTruthy();
    expect(within(card).getByRole('link', { name: 'Ver salud de nodos' }).getAttribute('href')).toBe('/admin/salud');
  });

  it('does not break the dashboard when the providers call fails', async () => {
    mocked.mockImplementation((async (url: string) => {
      if (url.startsWith('admin/dashboard')) return dash;
      throw new Error('boom');
    }) as never);
    renderIn(<AdminDashboardPage />);
    expect(await screen.findByText('Conversión')).toBeTruthy();
    expect(await screen.findByText(/No se pudo leer el estado de los proveedores/)).toBeTruthy();
  });
});
