// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const AIRPORTS = [
  { iata: 'UIO', ciudad: 'Quito', nombre: 'Mariscal Sucre', paisNombre: 'Ecuador' },
  { iata: 'GYE', ciudad: 'Guayaquil', nombre: 'José Joaquín de Olmedo', paisNombre: 'Ecuador' },
  { iata: 'BOG', ciudad: 'Bogotá', nombre: 'El Dorado', paisNombre: 'Colombia' },
];

vi.mock('../../src/api/endpoints/catalog', () => ({
  useLocalidades: (q?: string) => ({
    data: AIRPORTS.filter((a) => !q || `${a.iata} ${a.ciudad}`.toLowerCase().includes(q.toLowerCase())),
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

import { AirportPicker } from '../../src/features/search/AirportPicker';

afterEach(cleanup);

function Harness({ error, onChange }: { error?: string; onChange?: (v: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <AirportPicker
        label="Origen"
        placeholder="¿Desde dónde?"
        type="origin"
        value={value}
        error={error}
        onChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
      />
      <button type="button">Siguiente campo</button>
    </form>
  );
}

const combobox = () => screen.getByRole('combobox', { name: 'Origen' });
const activeOption = () => {
  const id = combobox().getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
};

describe('AirportPicker (ARIA combobox)', () => {
  it('is a labelled combobox wired to its listbox', () => {
    render(<Harness />);
    const input = combobox();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    fireEvent.focus(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    const listbox = screen.getByRole('listbox');
    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('moves with the arrows (wrapping), Home/End, and chooses with Enter', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = combobox();
    input.focus();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(activeOption()?.textContent).toContain('Quito');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(activeOption()?.textContent).toContain('Guayaquil');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(activeOption()?.textContent).toContain('Bogotá'); // wrapped to the last one
    fireEvent.keyDown(input, { key: 'Home' });
    expect(activeOption()?.textContent).toContain('Quito');
    fireEvent.keyDown(input, { key: 'End' });
    expect(activeOption()?.textContent).toContain('Bogotá');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('BOG');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
    expect((input as HTMLInputElement).value).toContain('BOG');
  });

  it('filters while typing and keeps the active option inside the results', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = combobox();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'End' });
    expect(activeOption()?.textContent).toContain('Bogotá'); // index 2 of 3

    fireEvent.change(input, { target: { value: 'gua' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(activeOption()?.textContent).toContain('Guayaquil');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('GYE');
  });

  it('closes with Escape without choosing, and the focus stays on the input', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = combobox();
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
  });

  it('Enter with the list open never submits the surrounding form', () => {
    const submit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={submit}>
        <AirportPicker label="Origen" placeholder="" type="origin" onChange={() => undefined} />
      </form>,
    );
    const input = combobox();
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const event = fireEvent.keyDown(input, { key: 'Enter' });
    expect(event).toBe(false); // default prevented
    expect(submit).not.toHaveBeenCalled();
  });

  it('chooses with the pointer', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.focus(combobox());
    fireEvent.mouseDown(screen.getByRole('option', { name: /Guayaquil/ }));
    expect(onChange).toHaveBeenCalledWith('GYE');
  });

  it('closes when the focus leaves the widget', () => {
    render(<Harness />);
    const input = combobox();
    fireEvent.focus(input);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.blur(input, { relatedTarget: screen.getByRole('button', { name: 'Siguiente campo' }) });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('exposes the error: aria-invalid, aria-describedby and role="alert"', () => {
    render(<Harness error="Elige el aeropuerto de origen" />);
    const input = combobox();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Elige el aeropuerto de origen');
    expect(input.getAttribute('aria-describedby')).toBe(alert.id);
  });
});
