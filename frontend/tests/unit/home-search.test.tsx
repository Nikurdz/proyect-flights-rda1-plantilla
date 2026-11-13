// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const AIRPORTS = [
  { iata: 'UIO', ciudad: 'Quito', nombre: 'Mariscal Sucre', paisNombre: 'Ecuador' },
  { iata: 'GYE', ciudad: 'Guayaquil', nombre: 'José Joaquín de Olmedo', paisNombre: 'Ecuador' },
];

vi.mock('../../src/api/endpoints/catalog', () => ({
  useLocalidades: (q?: string) => ({
    data: AIRPORTS.filter((a) => !q || `${a.iata} ${a.ciudad}`.toLowerCase().includes(q.toLowerCase())),
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

import { HomePage } from '../../src/features/search/HomePage';

afterEach(cleanup);

const renderHome = () =>
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );

describe('Home: the search is the hero', () => {
  it('opens with the search form and one main action, without the fake cabin chip or a second passenger picker', () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1, name: '¿A dónde viajas?' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Buscar vuelos' })).toHaveLength(1);
    expect(screen.queryByText(/Cabina Economy/i)).toBeNull();
    expect(screen.queryByText('VUELOS DIRECTOS')).toBeNull();
    expect(screen.getAllByText('Pasajeros')).toHaveLength(1);
  });

  it('asks for cities, not airport codes, and states the fixed cabin as help text', () => {
    renderHome();
    expect(screen.getByRole('combobox', { name: 'Origen' }).getAttribute('placeholder')).toMatch(/Quito/);
    expect(screen.getByRole('combobox', { name: 'Destino' }).getAttribute('placeholder')).not.toMatch(/\b[A-Z]{3}\b/);
    expect(screen.getByText(/clase económica/)).toBeTruthy();
  });

  it('a route shortcut fills the form instead of searching', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: /Quito a Guayaquil/ }));
    expect((screen.getByRole('combobox', { name: 'Origen' }) as HTMLInputElement).value).toBe('Quito (UIO)');
    expect((screen.getByRole('combobox', { name: 'Destino' }) as HTMLInputElement).value).toBe('Guayaquil (GYE)');
  });

  it('explains what is missing next to the field, without browser bubbles', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Buscar vuelos' }));
    expect(screen.getByText('Elige desde dónde sales.')).toBeTruthy();
    expect(screen.getByText('Elige a dónde viajas.')).toBeTruthy();
  });
});
