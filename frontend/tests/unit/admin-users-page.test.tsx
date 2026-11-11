// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/client', () => ({ apiClient: vi.fn() }));
vi.mock('../../src/lib/session', () => ({ useSession: () => ({ ownerId: 'me-1' }) }));

import { apiClient } from '../../src/api/client';
import { ProblemDetailsError } from '../../src/api/problem-details';
import { AdminUsersPage } from '../../src/features/admin/AdminUsersPage';

const mocked = vi.mocked(apiClient);

const user = (over: Record<string, unknown>) => ({
  clienteId: 'x',
  correo: 'x@ram.com',
  nombres: 'N',
  apellidos: 'A',
  roles: ['CUSTOMER'],
  correoVerificado: true,
  bloqueada: false,
  creadoEn: '2026-10-01T10:00:00.000Z',
  ...over,
});

const page = {
  items: [
    user({ clienteId: 'me-1', correo: 'yo@ram.com', nombres: 'Yo', roles: ['CUSTOMER', 'ADMIN'] }),
    user({ clienteId: 'adm-2', correo: 'otro@ram.com', nombres: 'Otro', roles: ['CUSTOMER', 'ADMIN'] }),
    user({ clienteId: 'cli-3', correo: 'cliente@ram.com', nombres: 'Cliente', roles: ['CUSTOMER'] }),
  ],
  total: 3,
  pagina: 1,
  limite: 25,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminUsersPage />
    </QueryClientProvider>,
  );
}

describe('AdminUsersPage', () => {
  beforeEach(() => {
    mocked.mockReset();
    mocked.mockResolvedValue(page as never);
  });
  afterEach(cleanup);

  it('lists users with role badges and the re-login notice', async () => {
    renderPage();
    expect(await screen.findByText('cliente@ram.com')).toBeTruthy();
    expect(screen.getAllByText('Administrador').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Cliente').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('note').textContent).toMatch(/inicia sesión de nuevo/);
    expect(String(mocked.mock.calls[0][0])).toContain('admin/usuarios?pagina=1&limite=25');
  });

  it('does not let the signed-in admin remove their own role', async () => {
    renderPage();
    await screen.findByText('yo@ram.com');
    const quitar = screen.getAllByRole('button', { name: 'Quitar administrador' }) as HTMLButtonElement[];
    expect(quitar).toHaveLength(2);
    const [mine, other] = quitar;
    expect(mine.disabled).toBe(true);
    expect(screen.getByText('No puedes quitarte tu propio rol de administrador.')).toBeTruthy();
    expect(other.disabled).toBe(false);
  });

  it('promotes a customer after confirming, sending both roles', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Hacer administrador' }));
    const dialog = await screen.findByRole('dialog');
    mocked.mockResolvedValue(user({ clienteId: 'cli-3', roles: ['CUSTOMER', 'ADMIN'] }) as never);
    const buttons = dialog.querySelectorAll('button');
    fireEvent.click(buttons[buttons.length - 1] as HTMLButtonElement);
    await waitFor(() => {
      const call = mocked.mock.calls.find(([url]) => String(url).includes('admin/usuarios/cli-3/roles'));
      expect(call).toBeTruthy();
      expect(call![1]).toMatchObject({ method: 'PUT', body: JSON.stringify({ roles: ['CUSTOMER', 'ADMIN'] }) });
    });
    expect(await screen.findByText(/ahora es administrador/)).toBeTruthy();
  });

  it('shows the LAST_ADMIN problem inside the confirmation dialog and closes with Escape', async () => {
    renderPage();
    await screen.findByText('otro@ram.com');
    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar administrador' })[1]);
    const dialog = await screen.findByRole('dialog');
    mocked.mockRejectedValue(new ProblemDetailsError({ status: 409, code: 'LAST_ADMIN' }));
    const buttons = dialog.querySelectorAll('button');
    fireEvent.click(buttons[buttons.length - 1] as HTMLButtonElement);
    expect(await screen.findByText(/dejar el sistema sin administradores/)).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('validates the create form on the client and shows a server conflict', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Crear usuario/ }));
    const dialog = await screen.findByRole('dialog');
    const submit = Array.from(dialog.querySelectorAll('button')).find((b) => b.type === 'submit') as HTMLButtonElement;
    fireEvent.click(submit);
    expect(await screen.findByText('Ingresa el correo.')).toBeTruthy();
    expect(mocked.mock.calls.some(([, o]) => (o as { method?: string } | undefined)?.method === 'POST')).toBe(false);

    const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
    type('Nombres', 'Ana');
    type('Apellidos', 'Paz');
    type('Correo electrónico', 'cliente@ram.com');
    type('Contraseña inicial', 'Clave12345');
    type('Fecha de nacimiento', '1990-01-01');
    mocked.mockRejectedValue(new ProblemDetailsError({ status: 409, code: 'EMAIL_ALREADY_REGISTERED' }));
    fireEvent.click(submit);
    expect(await screen.findByText('Ya existe un usuario con ese correo. Usa otro correo.')).toBeTruthy();
  });
});
