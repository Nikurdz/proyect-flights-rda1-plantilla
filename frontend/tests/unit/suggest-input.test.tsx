// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SuggestInput } from '../../src/components/ui/SuggestInput';
import { filterSuggestions } from '../../src/lib/suggestions';

const AIRPORTS = [
  { value: 'UIO', label: 'UIO · Quito', hint: 'Mariscal Sucre' },
  { value: 'GYE', label: 'GYE · Guayaquil', hint: 'José Joaquín de Olmedo' },
  { value: 'BOG', label: 'BOG · Bogotá', hint: 'El Dorado' },
];

const Controlled: React.FC<{ onSelect?: (v: string) => void }> = ({ onSelect }) => {
  const [value, setValue] = useState('');
  return (
    <>
      <SuggestInput label="Origen" suggestions={AIRPORTS} value={value} onChange={(e) => setValue(e.target.value)} onSuggestionSelect={(s) => onSelect?.(s.value)} />
      <output data-testid="value">{value}</output>
    </>
  );
};

describe('filterSuggestions', () => {
  it('ignores accents and case, and puts prefix matches first', () => {
    expect(filterSuggestions(AIRPORTS, 'bogota').map((s) => s.value)).toEqual(['BOG']);
    expect(filterSuggestions(AIRPORTS, 'gu').map((s) => s.value)).toEqual(['GYE']);
    expect(filterSuggestions(AIRPORTS, 'o').map((s) => s.value)).toEqual(['UIO', 'GYE', 'BOG']);
  });
});

describe('SuggestInput', () => {
  afterEach(cleanup);

  it('filters live and exposes the ARIA combobox pattern', () => {
    render(<Controlled />);
    const input = screen.getByRole('combobox', { name: 'Origen' });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    fireEvent.focus(input);
    expect(screen.getAllByRole('option')).toHaveLength(3);
    fireEvent.change(input, { target: { value: 'quito' } });
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['UIO · QuitoMariscal Sucre']);
  });

  it('chooses with the keyboard and fills the value', () => {
    const onSelect = vi.fn();
    render(<Controlled onSelect={onSelect} />);
    const input = screen.getByRole('combobox', { name: 'Origen' });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('value').textContent).toBe('GYE');
    expect(onSelect).toHaveBeenCalledWith('GYE');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes with Escape and keeps free text that matches nothing', () => {
    render(<Controlled />);
    const input = screen.getByRole('combobox', { name: 'Origen' });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.change(input, { target: { value: 'ZZZ' } });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByTestId('value').textContent).toBe('ZZZ');
  });

  it('chooses with the mouse', () => {
    render(<Controlled />);
    const input = screen.getByRole('combobox', { name: 'Origen' });
    fireEvent.focus(input);
    fireEvent.mouseDown(screen.getAllByRole('option')[2]);
    expect(screen.getByTestId('value').textContent).toBe('BOG');
  });
});
