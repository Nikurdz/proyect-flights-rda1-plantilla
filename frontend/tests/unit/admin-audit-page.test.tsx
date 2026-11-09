// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/client', () => ({ apiClient: vi.fn(), apiBlob: vi.fn(), saveBlob: vi.fn() }));
vi.mock('../../src/lib/session', () => ({ useSession: () => ({ ownerId: 'admin-1' }) }));

import { apiBlob, apiClient, saveBlob } from '../../src/api/client';
import { ProblemDetailsError } from '../../src/api/problem-details';
import { AdminAuditPage } from '../../src/features/admin/AdminAuditPage';

const mocked = vi.mocked(apiClient);

const evento = {
  fuente: 'evento',
  id: 'e1',
  en: '2026-11-09T15:00:00.000Z',
  correlationId: 'corr-aaa',
  tipo: 'booking.cancelled',
  estado: 'OK',
  actorId: '0a1b2c3d-4e5f-6789-abcd-ef0123456789',
  actorTipo: 'CUSTOMER',
  entidad: 'booking',
  referencia: 'bk-1',
  numero: 'ABC123',
  origen: 'api',
  destino: 'ordenes',
  resumen: 'Reserva cancelada',
};
const saga = {
  fuente: 'saga',
  id: 's1',
  en: '2026-11-09T14:00:00.000Z',
  correlationId: 'corr-bbb',
  tipo: 'COMPRA',
  estado: 'COMPENSADA',
  actorId: null,
  actorTipo: 'SYSTEM',
  entidad: 'oferta',
  referencia: 'of-1',
  numero: 'ORD-1',
  origen: null,
  destino: null,
  resumen: 'Compra compensada',
  pasos: [
    { secuencia: 2, nombre: 'emitir', estado: 'FALLIDO', detalle: 'sin cupo', duracionMs: 2500, en: null },
    { secuencia: 1, nombre: 'autorizar-pago', estado: 'OK', detalle: null, duracionMs: 120, en: null },
  ],
};
const page1 = { items: [evento, saga], siguiente: 'cursor-1' };
const page2 = { items: [{ ...evento, id: 'e2', tipo: 'OrdenEmitida', resumen: 'Orden emitida', correlationId: 'corr-ccc' }], siguiente: null };

const nodos = [
  { id: 'web', etiqueta: 'Web', tipo: 'cliente' },
  { id: 'api', etiqueta: 'API', tipo: 'servicio' },
  { id: 'ordenes', etiqueta: 'Órdenes', tipo: 'servicio' },
  { id: 'booking', etiqueta: 'Booking', tipo: 'externo' },
  { id: 'raro', etiqueta: 'Nodo raro', tipo: 'servicio' },
];
const flujo = {
  nodos,
  aristas: [
    { orden: 2, desde: 'api', hasta: 'ordenes', etiqueta: 'crear orden', fuente: 'saga', estado: 'ERROR', ms: 40, en: '2026-11-09T15:00:01.000Z', correlationId: 'corr-aaa' },
    { orden: 1, desde: 'web', hasta: 'api', etiqueta: 'comprar', fuente: 'evento', estado: 'OK', ms: null, en: '2026-11-09T15:00:00.000Z', correlationId: 'corr-aaa' },
    { orden: 3, desde: 'ordenes', hasta: 'ordenes', etiqueta: 'compensar', fuente: 'saga', estado: 'COMPENSADA', ms: null, en: null, correlationId: 'corr-aaa' },
    { orden: 4, desde: 'api', hasta: 'booking', etiqueta: 'notificar', fuente: 'evento', estado: 'OK', ms: null, en: null, correlationId: 'corr-aaa' },
  ],
  correlaciones: ['corr-aaa'],
  truncado: false,
};
const mapa = {
  nodos,
  enlaces: [
    { desde: 'web', hasta: 'api', total: 12, errores: 0 },
    { desde: 'api', hasta: 'ordenes', total: 5, errores: 2 },
  ],
};

function respond(overrides: { flujo?: unknown } = {}) {
  mocked.mockImplementation((async (url: string) => {
    if (url.startsWith('admin/trazabilidad/flujo')) return overrides.flujo ?? flujo;
    if (url.startsWith('admin/trazabilidad/mapa')) return mapa;
    if (url.includes('antes=cursor-1')) return page2;
    return page1;
  }) as never);
}

let client: QueryClient;
function renderPage(initial = '/admin/auditoria') {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initial]}>
        <AdminAuditPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminAuditPage (trazabilidad)', () => {
  beforeEach(() => {
    mocked.mockReset();
    vi.mocked(apiBlob).mockReset();
    vi.mocked(saveBlob).mockReset();
    respond();
  });
  afterEach(cleanup);

  it('shows the fixed text, the unified table with actor, status and Ecuador time', async () => {
    renderPage();
    expect(await screen.findByText('booking.cancelled')).toBeTruthy();
    expect(screen.getByText(/Los proveedores no se incluyen\./)).toBeTruthy();
    const row = screen.getByText('booking.cancelled').closest('tr') as HTMLElement;
    expect(within(row).getByText('OK')).toBeTruthy();
    expect(within(row).getByText('CUSTOMER')).toBeTruthy();
    expect(within(row).getByText('0a1b2c3d4e'.slice(0, 8), { exact: false })).toBeTruthy();
    expect(within(row).getByText('ABC123')).toBeTruthy();
    // 15:00 UTC is 10:00 in Ecuador.
    expect(row.textContent).toMatch(/10:00/);
    expect(screen.getByText('Compensada')).toBeTruthy();
    expect(mocked.mock.calls[0][0]).toBe('admin/trazabilidad?limite=50');
  });

  it('expands a saga row with its steps in order', async () => {
    renderPage();
    const toggle = await screen.findByRole('button', { name: /Ver los pasos de la saga COMPRA/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    const table = await screen.findByRole('table', { name: /Pasos de la saga COMPRA/ });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell')[1].textContent)).toEqual(['autorizar-pago', 'emitir']);
    expect(within(rows[1]).getByText('2,5 s')).toBeTruthy();
    expect(within(rows[1]).getByText('Falló')).toBeTruthy();
  });

  it('sends only the filled filters, as query params', async () => {
    renderPage();
    await screen.findByText('booking.cancelled');
    fireEvent.change(screen.getByLabelText('Orden o PNR'), { target: { value: '  ABC123 ' } });
    fireEvent.change(screen.getByLabelText('Fuente'), { target: { value: 'saga' } });
    fireEvent.change(screen.getByLabelText('Desde (día de Ecuador)'), { target: { value: '2026-11-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(mocked.mock.calls.some(([u]) => u === 'admin/trazabilidad?numero=ABC123&fuente=saga&desde=2026-11-01&limite=50')).toBe(true));
    expect(mocked.mock.calls[0][0]).not.toContain('actor');
    expect(mocked.mock.calls[0][0]).not.toContain('tipo');
  });

  it('reads the correlation id from the link and offers the flow for the order in the filter', async () => {
    renderPage('/admin/auditoria?correlationId=corr-bbb');
    await screen.findByText('booking.cancelled');
    expect((screen.getByLabelText('Correlation id') as HTMLInputElement).value).toBe('corr-bbb');
    expect(mocked.mock.calls[0][0]).toBe('admin/trazabilidad?correlationId=corr-bbb&limite=50');
    const links = screen.getAllByRole('link', { name: /Ver todo lo que tocó la correlación corr-aaa/ });
    expect(links[0].getAttribute('href')).toBe('/admin/auditoria?correlationId=corr-aaa');

    fireEvent.change(screen.getByLabelText('Orden o PNR'), { target: { value: 'ORD-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ver flujo de ORD-1' }));
    await screen.findByRole('dialog');
    await waitFor(() => expect(mocked.mock.calls.some(([u]) => u === 'admin/trazabilidad/flujo?numero=ORD-1')).toBe(true));
  });

  it('loads more with the cursor and stops when there is none', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Cargar más' }));
    expect(await screen.findByText('OrdenEmitida')).toBeTruthy();
    expect(mocked.mock.calls.some(([u]) => u === 'admin/trazabilidad?antes=cursor-1&limite=50')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
    expect(screen.getByText('booking.cancelled')).toBeTruthy();
  });

  it('shows an empty state', async () => {
    mocked.mockResolvedValue({ items: [], siguiente: null } as never);
    renderPage();
    expect(await screen.findByText('No hay actividad registrada con estos filtros.')).toBeTruthy();
  });

  it('shows the flow graph from a row: ordered arrows, state text, error arrow, self loop, unknown node', async () => {
    renderPage();
    const row = (await screen.findByText('booking.cancelled')).closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: /Ver flujo de la correlación corr-aaa/ }));
    const dialog = await screen.findByRole('dialog', { name: /Flujo de comunicación/ });
    await waitFor(() => expect(dialog.querySelectorAll('[data-edge]').length).toBe(4));
    expect(mocked.mock.calls.some(([u]) => u === 'admin/trazabilidad/flujo?correlationId=corr-aaa')).toBe(true);

    const arrows = Array.from(dialog.querySelectorAll('[data-edge]'));
    expect(arrows.map((a) => a.getAttribute('data-edge'))).toEqual(['1', '2', '3', '4']);
    expect(arrows[0].getAttribute('aria-label')).toBe('Paso 1: Web a API, comprar. Estado: OK');
    // The error arrow carries its state as text and as a dashed red stroke, not colour alone.
    expect(arrows[1].getAttribute('data-estado')).toBe('ERROR');
    expect(arrows[1].getAttribute('aria-label')).toContain('Estado: Error');
    expect(arrows[1].querySelector('path[stroke-dasharray]')).not.toBeNull();
    // A loop: ordenes -> ordenes is drawn as a cubic curve, not a straight line.
    expect(arrows[2].getAttribute('aria-label')).toContain('Órdenes a Órdenes');
    expect(arrows[2].querySelector('path[d*=" C "]')).not.toBeNull();
    // Every node of the answer, including the one the code does not know.
    expect(Array.from(dialog.querySelectorAll('[data-node]')).map((n) => n.getAttribute('data-node'))).toEqual(['web', 'api', 'ordenes', 'booking', 'raro']);
    expect(within(dialog).getAllByText('Nodo raro').length).toBeGreaterThan(0);
    // Same information as a text list, in order.
    const list = within(dialog).getByRole('list', { name: 'Pasos del flujo en orden' });
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent?.slice(0, 2))).toEqual(['1.', '2.', '3.', '4.']);
    expect(within(list).getByText('Compensada')).toBeTruthy();
    expect(within(dialog).queryByRole('note')).toBeNull();

    // Click or focus on an arrow shows its detail.
    fireEvent.focus(arrows[1]);
    const detail = within(dialog).getByText('Detalle de la flecha').parentElement as HTMLElement;
    expect(detail.textContent).toContain('crear orden');
    expect(detail.textContent).toContain('40 ms');
    expect(detail.textContent).toContain('corr-aaa');
    expect(detail.textContent).toMatch(/10:00/);
  });

  it('warns when the flow was cut at 500 steps', async () => {
    respond({ flujo: { ...flujo, truncado: true } });
    renderPage();
    const row = (await screen.findByText('booking.cancelled')).closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: /Ver flujo/ }));
    const dialog = await screen.findByRole('dialog');
    expect((await within(dialog).findByRole('note')).textContent).toContain('500 pasos');
  });

  it('polls the flow only while the panel is open and closes with Escape', async () => {
    renderPage();
    const row = (await screen.findByText('booking.cancelled')).closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: /Ver flujo/ }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog.querySelectorAll('[data-edge]').length).toBe(4));
    const query = client.getQueryCache().findAll({ queryKey: ['admin-traza-flujo'] })[0];
    expect(query?.getObserversCount()).toBe(1);
    const observer = query?.observers[0];
    expect(observer?.options.refetchInterval).toBe(10_000);
    expect(observer?.options.refetchIntervalInBackground).toBe(false);

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(client.getQueryCache().findAll({ queryKey: ['admin-traza-flujo'] })[0]?.getObserversCount()).toBe(0);
  });

  it('opens the general map with totals and red for links with errors', async () => {
    renderPage();
    await screen.findByText('booking.cancelled');
    fireEvent.click(screen.getByRole('button', { name: 'Mapa general' }));
    const dialog = await screen.findByRole('dialog', { name: /Mapa general/ });
    await waitFor(() => expect(dialog.querySelectorAll('g[role="button"]').length).toBe(2));
    expect(mocked.mock.calls.some(([u]) => u === 'admin/trazabilidad/mapa')).toBe(true);
    const links = Array.from(dialog.querySelectorAll('g[role="button"]'));
    expect(links[0].getAttribute('aria-label')).toBe('Web a API, 12 llamadas. Estado: OK');
    expect(links[1].getAttribute('data-estado')).toBe('ERROR');
    expect(links[1].getAttribute('aria-label')).toContain('2 con error');
    expect(links[1].querySelector('path[stroke="#b91c1c"]')).not.toBeNull();
  });

  it('sends the date range to the map', async () => {
    renderPage();
    await screen.findByText('booking.cancelled');
    fireEvent.change(screen.getByLabelText('Desde (día de Ecuador)'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText('Hasta (día de Ecuador)'), { target: { value: '2026-11-05' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(mocked.mock.calls.some(([u]) => String(u).includes('desde=2026-11-01'))).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Mapa general' }));
    await waitFor(() => expect(mocked.mock.calls.some(([u]) => u === 'admin/trazabilidad/mapa?desde=2026-11-01&hasta=2026-11-05')).toBe(true));
  });

  it('exports the CSV with the applied filters', async () => {
    vi.mocked(apiBlob).mockResolvedValue(new Blob(['a']));
    renderPage();
    await screen.findByText('booking.cancelled');
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'booking.cancelled' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(mocked.mock.calls.some(([u]) => String(u).includes('tipo=booking.cancelled'))).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalled());
    expect(vi.mocked(apiBlob).mock.calls[0][0]).toBe('admin/trazabilidad/export.csv?tipo=booking.cancelled');
    expect(vi.mocked(saveBlob).mock.calls[0][1]).toMatch(/^trazabilidad-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(await screen.findByText(/Descargado trazabilidad-/)).toBeTruthy();
  });

  it('shows a 403 problem+json as a readable alert', async () => {
    mocked.mockRejectedValue(new ProblemDetailsError({ status: 403, code: 'FORBIDDEN' }));
    renderPage();
    const alerts = await screen.findAllByRole('alert');
    expect(alerts[0].textContent).toContain('No tienes permiso para ver esta información.');
  });

  it('shows an export failure', async () => {
    vi.mocked(apiBlob).mockRejectedValue(new ProblemDetailsError({ status: 403, code: 'FORBIDDEN' }));
    renderPage();
    await screen.findByText('booking.cancelled');
    fireEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No tienes permiso');
  });
});
