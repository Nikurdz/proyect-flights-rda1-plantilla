// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { AdminLayout } from '../../src/features/admin/AdminLayout';
import { AdminPageHeader } from '../../src/features/admin/AdminPageHeader';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="dashboard" element={<AdminPageHeader page="dashboard" />} />
          <Route path="facturacion-booking" element={<AdminPageHeader page="facturacion-booking" />} />
          <Route path="auditoria" element={<AdminPageHeader page="auditoria" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('AdminLayout navigation', () => {
  it('groups the pages in Ventas, Operación, Finanzas and Sistema with the unchanged routes', () => {
    renderAt('/admin/dashboard');
    const nav = screen.getByRole('navigation', { name: 'Administración' });
    const groups = within(nav)
      .getAllByRole('list')
      .map((list) => ({
        name: list.getAttribute('aria-labelledby') ? document.getElementById(list.getAttribute('aria-labelledby') as string)?.textContent : '',
        links: within(list)
          .getAllByRole('link')
          .map((a) => [a.textContent, a.getAttribute('href')]),
      }));
    expect(groups).toEqual([
      { name: 'Ventas', links: [['Resumen', '/admin/dashboard'], ['Órdenes', '/admin/ordenes'], ['Reservas de mostrador', '/admin/reservas']] },
      { name: 'Operación', links: [['Vuelos', '/admin/vuelos'], ['Aeropuertos', '/admin/aeropuertos']] },
      { name: 'Finanzas', links: [['Facturas', '/admin/facturacion'], ['Conciliación Booking', '/admin/facturacion-booking']] },
      {
        name: 'Sistema',
        links: [['Usuarios', '/admin/usuarios'], ['Webhooks', '/admin/webhooks'], ['Trazabilidad', '/admin/auditoria'], ['Observabilidad', '/admin/observabilidad']],
      },
    ]);
  });

  it('marks only the current page with aria-current="page"', () => {
    renderAt('/admin/facturacion-booking');
    const nav = screen.getByRole('navigation', { name: 'Administración' });
    const current = within(nav).getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.textContent)).toEqual(['Conciliación Booking']);
  });

  it('does not promise a system status and keeps hidden pages out of the menu', () => {
    renderAt('/admin/dashboard');
    expect(screen.queryByText(/estado del sistema/i)).toBeNull();
    expect(screen.queryByRole('link', { name: /Proveedores|Salud/ })).toBeNull();
  });

  it('opens and closes the phone menu with an accessible button', () => {
    renderAt('/admin/auditoria');
    const toggle = screen.getByRole('button', { name: /Menú de administración/ });
    expect(toggle.textContent).toContain('Trazabilidad');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows the breadcrumbs «Administración › Grupo › Página» and one h1', () => {
    renderAt('/admin/auditoria');
    const crumbs = screen.getByRole('navigation', { name: 'Ruta de navegación' });
    expect(within(crumbs).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Administración', 'Sistema', 'Trazabilidad']);
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Trazabilidad']);
  });
});
