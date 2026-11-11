// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/client', () => ({ apiClient: vi.fn() }));
vi.mock('../../src/lib/session', () => ({ useSession: () => ({ ownerId: 'admin-1' }) }));

import { apiClient } from '../../src/api/client';
import { AdminDashboardPage } from '../../src/features/admin/AdminDashboardPage';

const mocked = vi.mocked(apiClient);

const data = (over: Record<string, unknown> = {}) => ({
  dias: 30,
  moneda: 'USD',
  generadoEn: '2026-10-08T12:00:00.000Z',
  desde: '2026-09-09',
  hasta: '2026-10-08',
  kpis: { ingresosMinor: 123456, ordenesEmitidas: 4, ticketPromedioMinor: 30864, pasajeros: 6, conversion: null, tasaCancelacion: 0.25, reembolsosMinor: 5000, ocupacionFutura: 0.4, vuelosAgotados: 1, rechazoDePago: 0.1 },
  serie: [
    { fecha: '2026-10-07', ordenes: 2, emitidas: 2, ingresosMinor: 60000, ofertas: 3, cancelaciones: 0 },
    { fecha: '2026-10-08', ordenes: 2, emitidas: 2, ingresosMinor: 63456, ofertas: 4, cancelaciones: 1 },
  ],
  embudo: [{ etapa: 'Ofertas creadas', valor: 7 }, { etapa: 'Órdenes emitidas', valor: 4 }],
  ordenesPorEstado: { EMITIDA: 4 },
  pagosPorEstado: { CAPTURADO: 4, RECHAZADO: 1 },
  ofertasPorEstado: {},
  notificacionesPorEstado: {},
  pasajerosPorTipo: { ADULT: 5, CHILD: 1 },
  topRutas: [{ ruta: 'BOG-SCL', reservas: 3, canceladas: 1, ingresos: 900.5 }],
  ocupacionPorRuta: [{ ruta: 'BOG-SCL', vuelos: 2, capacidad: 100, libres: 5, agotados: 0, ocupacion: 0.95 }],
  posventa: { maletasExtra: 2, ingresosEquipajeMinor: 4000, cambiosDeFecha: 1, cancelaciones: 1, checkIns: 3 },
  webhooks: { entregasPendientes: 1, entregasEntregadas: 8, entregasMuertas: 2 },
  ...over,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminDashboardPage', () => {
  beforeEach(() => mocked.mockReset());

  it('renders KPIs, charts and the dead-webhook alert', async () => {
    mocked.mockResolvedValue(data() as never);
    renderPage();
    expect(await screen.findByText('$1,234.56')).toBeTruthy();
    expect(screen.getByText('Conversión')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: /Ingresos por día/ })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Ocupación por ruta/ })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('entregas muertas');
    expect(mocked.mock.calls[0][0]).toBe('admin/dashboard?dias=30');
  });

  it('shows the empty state when there are no sales', async () => {
    mocked.mockResolvedValue(
      data({
        kpis: { ...data().kpis, ordenesEmitidas: 0 },
        serie: [{ fecha: '2026-10-08', ordenes: 0, emitidas: 0, ingresosMinor: 0, ofertas: 0, cancelaciones: 0 }],
        webhooks: { entregasPendientes: 0, entregasEntregadas: 0, entregasMuertas: 0 },
      }) as never,
    );
    renderPage();
    await waitFor(() => expect(screen.getByText(/Sin ventas en los últimos 30 días/)).toBeTruthy());
  });
});
