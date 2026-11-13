// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ItinerarioDto } from '../../src/api/types';
import { FlightCard } from '../../src/features/results/FlightCard';

afterEach(cleanup);

const flight = (overrides: Partial<ItinerarioDto> = {}): ItinerarioDto =>
  ({
    itinerarioId: 'it-1',
    numeroVuelo: 'RA2500',
    operador: { nombre: 'RAM Alliance' },
    origen: { iata: 'UIO', ciudad: 'Quito' },
    destino: { iata: 'GYE', ciudad: 'Guayaquil' },
    salida: '2026-11-20T12:00:00.000Z',
    llegada: '2026-11-20T12:50:00.000Z',
    duracionMinutos: 50,
    escalas: 0,
    cruceDeDia: false,
    precioDesde: { moneda: 'USD', monto: '86.00' },
    familiaDesde: 'BASIC',
    distintivos: [],
    ultimosAsientos: false,
    agotado: false,
    ...overrides,
  }) as unknown as ItinerarioDto;

describe('FlightCard (boarding pass)', () => {
  it('shows the codes, the price per adult and the total of the group in the stub', () => {
    render(<FlightCard itinerario={flight()} group={{ adt: 2, yth: 1, chd: 0, inf: 0 }} passengerCount={3} onSelect={() => undefined} />);
    expect(screen.getByText('UIO')).toBeTruthy();
    expect(screen.getByText('GYE')).toBeTruthy();
    expect(screen.getByText('$86.00')).toBeTruthy();
    // 3 paying travellers x 86.00
    expect(screen.getByText('$258.00')).toBeTruthy();
    expect(screen.getByText(/en total para 2 adultos, 1 joven/)).toBeTruthy();
  });

  it('does not repeat the total for a single traveller', () => {
    render(<FlightCard itinerario={flight()} onSelect={() => undefined} />);
    expect(screen.queryByText(/en total para/)).toBeNull();
  });

  it('says the group total comes with the fare when children or infants travel', () => {
    render(<FlightCard itinerario={flight()} group={{ adt: 1, yth: 0, chd: 1, inf: 0 }} passengerCount={2} onSelect={() => undefined} />);
    expect(screen.getByText(/El total de tu grupo se calcula al elegir la tarifa/)).toBeTruthy();
  });

  it('shows «Más conveniente» only on the flight marked as the cheapest', () => {
    const { rerender } = render(<FlightCard itinerario={flight()} bestValue onSelect={() => undefined} />);
    expect(screen.getByText('Más conveniente')).toBeTruthy();
    rerender(<FlightCard itinerario={flight()} onSelect={() => undefined} />);
    expect(screen.queryByText('Más conveniente')).toBeNull();
  });

  it('offers a single «Elegir» action and reports the flight', () => {
    const onSelect = vi.fn();
    const chosen = flight();
    render(<FlightCard itinerario={chosen} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Elegir vuelo RA2500/ }));
    expect(onSelect).toHaveBeenCalledWith(chosen);
  });

  it('a sold-out flight has no action and says why', () => {
    render(<FlightCard itinerario={flight({ agotado: true })} passengerCount={3} bestValue onSelect={() => undefined} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/Sin asientos para 3 pasajeros/)).toBeTruthy();
    expect(screen.queryByText('Más conveniente')).toBeNull();
  });
});
