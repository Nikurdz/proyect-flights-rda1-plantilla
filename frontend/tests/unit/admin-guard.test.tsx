// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ session: null as unknown, endSession: vi.fn() }));

vi.mock('../../src/lib/session', () => ({ useSession: () => state.session }));
vi.mock('../../src/lib/auth-actions', () => ({ endSession: state.endSession }));

import { RequireAdmin } from '../../src/routes/guards';

const Where: React.FC = () => {
  const location = useLocation();
  return <p>Ruta: {location.pathname + location.search}</p>;
};

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/admin/vuelos']}>
      <Routes>
        <Route element={<RequireAdmin />}>
          <Route path="/admin/vuelos" element={<p>Panel de vuelos</p>} />
        </Route>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => state.endSession.mockClear());
afterEach(cleanup);

describe('RequireAdmin', () => {
  it('lets an administrator in', () => {
    state.session = { kind: 'customer', isAdmin: true };
    renderGuard();
    expect(screen.getByText('Panel de vuelos')).toBeTruthy();
  });

  it('tells a customer why they cannot enter instead of redirecting silently', () => {
    state.session = { kind: 'customer', isAdmin: false };
    renderGuard();
    expect(screen.getByRole('heading', { name: 'Esta sección es solo para administradores' })).toBeTruthy();
    expect(screen.queryByText('Panel de vuelos')).toBeNull();
    expect(screen.getByRole('link', { name: 'Volver al inicio' }).getAttribute('href')).toBe('/');
  });

  it('offers to sign in with another account: ends the session and goes to the login keeping the destination', () => {
    state.session = { kind: 'customer', isAdmin: false };
    renderGuard();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión con otra cuenta' }));
    expect(state.endSession).toHaveBeenCalledTimes(1);
    expect(screen.getByText(`Ruta: /login?next=${encodeURIComponent('/admin/vuelos')}`)).toBeTruthy();
  });

  it('sends someone without a customer session to the login', () => {
    state.session = null;
    renderGuard();
    expect(screen.getByText(/Ruta: \/login\?next=/)).toBeTruthy();
  });
});
