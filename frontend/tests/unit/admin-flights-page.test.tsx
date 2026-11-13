// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/client', () => ({ apiClient: vi.fn() }));
vi.mock('../../src/lib/session', () => ({ useSession: () => ({ ownerId: 'me-1' }) }));

import { apiClient } from '../../src/api/client';
import { ToastProvider } from '../../src/components/ui/Toast';
import { AdminFlightsPage } from '../../src/features/admin/AdminFlightsPage';

const mocked = vi.mocked(apiClient);

const flight = {
  vueloId: 'v1',
  codigoVuelo: 'LA800',
  aerolinea: 'LATAM',
  origen: 'UIO',
  destino: 'GYE',
  salida: '2030-10-20T15:00:00.000Z',
  duracionMinutos: 50,
  precioBaseUsd: 86,
  capacidadTotal: 180,
  asientosDisponibles: 120,
  asientosReservados: 7,
  estado: 'SCHEDULED',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <AdminFlightsPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

async function openMenuItem(name: string) {
  const trigger = await screen.findByRole('button', { name: 'Acciones de vuelo LA800' });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('menuitem', { name }));
}

describe('AdminFlightsPage', () => {
  beforeEach(() => {
    mocked.mockReset();
    mocked.mockImplementation((async (url: string) => {
      if (String(url).includes('/reprogramar')) return { reservasAfectadas: 7 };
      if (String(url).includes('/estado')) return { previousStatus: 'SCHEDULED', affectedBookings: 7 };
      return { items: [flight], nextCursor: null };
    }) as never);
  });
  afterEach(cleanup);

  it('shows «Asientos reservados» and no «Asiento elegido», with the row actions in a menu', async () => {
    renderPage();
    expect(await screen.findByRole('columnheader', { name: 'Asientos reservados' })).toBeTruthy();
    expect(screen.queryByText('Asiento elegido')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Vuelos' })).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Acciones de vuelo LA800' }));
    const items = screen.getAllByRole('menuitem').map((i) => i.textContent);
    expect(items).toEqual(['Ver asientos', 'Editar', 'Reprogramar', 'Cambiar estado', 'Cancelar vuelo', 'Eliminar']);
    expect(screen.getByRole('separator')).toBeTruthy();
  });

  it('asks for confirmation before rescheduling, says how many seats are reserved and that clients are told', async () => {
    renderPage();
    await openMenuItem('Reprogramar');
    const form = await screen.findByRole('dialog', { name: /Reprogramar vuelo LA800/ });
    fireEvent.change(within(form).getByLabelText('Nueva salida (hora de Ecuador)'), { target: { value: '2030-10-21T10:00' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Continuar' }));

    const confirm = await screen.findByRole('dialog', { name: /¿Reprogramar el vuelo LA800\?/ });
    expect(confirm.textContent).toMatch(/7 asiento\(s\) reservado\(s\)/);
    expect(confirm.textContent).toMatch(/Avisaremos a los clientes/);
    expect(mocked.mock.calls.some(([u]) => String(u).includes('/reprogramar'))).toBe(false);

    fireEvent.click(within(confirm).getByRole('button', { name: 'Reprogramar vuelo' }));
    await waitFor(() => expect(mocked.mock.calls.some(([u]) => String(u).includes('/reprogramar'))).toBe(true));
    expect(await screen.findByText(/reprogramado\. Reservas actualizadas: 7/)).toBeTruthy();
  });

  it('can go back from the confirmation without sending anything', async () => {
    renderPage();
    await openMenuItem('Reprogramar');
    const form = await screen.findByRole('dialog', { name: /Reprogramar vuelo LA800/ });
    fireEvent.change(within(form).getByLabelText('Nueva salida (hora de Ecuador)'), { target: { value: '2030-10-21T10:00' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Continuar' }));
    const confirm = await screen.findByRole('dialog', { name: /¿Reprogramar el vuelo/ });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Volver' }));
    expect(await screen.findByRole('dialog', { name: /Reprogramar vuelo LA800/ })).toBeTruthy();
    expect(mocked.mock.calls.some(([u]) => String(u).includes('/reprogramar'))).toBe(false);
  });

  it('opens the status dialog with no state preselected and asks to choose one', async () => {
    renderPage();
    await openMenuItem('Cambiar estado');
    const dialog = await screen.findByRole('dialog', { name: /Estado del vuelo LA800/ });
    const select = within(dialog).getByLabelText('Estado') as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(within(select).getAllByRole('option')[0].textContent).toBe('Elige un estado');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar estado' }));
    expect(await within(dialog).findByText('Elige el estado.')).toBeTruthy();
    expect(mocked.mock.calls.some(([u]) => String(u).includes('/estado'))).toBe(false);
  });

  it('confirms a status change with a toast that does not mention Booking', async () => {
    renderPage();
    await openMenuItem('Cambiar estado');
    const dialog = await screen.findByRole('dialog', { name: /Estado del vuelo LA800/ });
    fireEvent.change(within(dialog).getByLabelText('Estado'), { target: { value: 'BOARDING' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar estado' }));
    const toast = await screen.findByText(/El nuevo estado ya es visible para los clientes y socios\./);
    expect(toast.textContent).not.toMatch(/Booking/);
  });
});
