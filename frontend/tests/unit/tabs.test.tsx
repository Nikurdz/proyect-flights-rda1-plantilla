// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Tabs } from '../../src/components/ui/Tabs';

afterEach(cleanup);

const tabs = [
  { id: 'a', label: 'Resumen', panel: <p>Contenido A</p> },
  { id: 'b', label: 'Pasajeros', panel: <p>Contenido B</p> },
  { id: 'c', label: 'Pagos', panel: <p>Contenido C</p> },
];

describe('Tabs', () => {
  it('has tablist, tabs and a tabpanel linked to the selected tab', () => {
    render(<Tabs tabs={tabs} ariaLabel="Secciones" />);
    expect(screen.getByRole('tablist', { name: 'Secciones' })).toBeTruthy();
    const first = screen.getByRole('tab', { name: 'Resumen' });
    expect(first.getAttribute('aria-selected')).toBe('true');
    expect(first.getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('tab', { name: 'Pasajeros' }).getAttribute('tabindex')).toBe('-1');
    expect(screen.getByRole('tabpanel', { name: 'Resumen' }).textContent).toBe('Contenido A');
  });

  it('moves with the arrow keys, wraps around, and Home/End jump to the ends', () => {
    render(<Tabs tabs={tabs} ariaLabel="Secciones" />);
    const first = screen.getByRole('tab', { name: 'Resumen' });
    first.focus();

    fireEvent.keyDown(first, { key: 'ArrowRight' });
    const second = screen.getByRole('tab', { name: 'Pasajeros' });
    expect(second.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(second);
    expect(screen.getByRole('tabpanel').textContent).toBe('Contenido B');

    fireEvent.keyDown(second, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Pagos' }));

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Resumen' }));

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Pagos' }));

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Home' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Resumen' }));
  });

  it('supports controlled use and clicks', () => {
    const calls: string[] = [];
    render(<Tabs tabs={tabs} value="b" onValueChange={(id) => calls.push(id)} ariaLabel="Secciones" />);
    expect(screen.getByRole('tabpanel').textContent).toBe('Contenido B');
    fireEvent.click(screen.getByRole('tab', { name: 'Pagos' }));
    expect(calls).toEqual(['c']);
  });
});
