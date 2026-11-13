// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RowActionsMenu } from '../../src/features/admin/RowActionsMenu';

const onEdit = vi.fn();
const onDelete = vi.fn();

function renderMenu() {
  return render(
    <RowActionsMenu
      subject="vuelo LA800"
      actions={[
        { label: 'Editar', onSelect: onEdit },
        { label: 'Cancelar vuelo', onSelect: vi.fn(), destructive: true, separated: true },
        { label: 'Eliminar', onSelect: onDelete, destructive: true },
      ]}
    />,
  );
}

afterEach(() => {
  cleanup();
  onEdit.mockClear();
  onDelete.mockClear();
});

describe('RowActionsMenu', () => {
  it('exposes a menu button with aria-haspopup and aria-expanded', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Acciones de vuelo LA800' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menu', { name: 'Acciones de vuelo LA800' })).toBeTruthy();
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Editar', 'Cancelar vuelo', 'Eliminar']);
    expect(screen.getByRole('separator')).toBeTruthy();
  });

  it('opens with ArrowDown, moves with the arrows, wraps and jumps with Home/End', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Acciones de vuelo LA800' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const items = screen.getAllByRole('menuitem');
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1], { key: 'End' });
    expect(document.activeElement).toBe(items[2]);
    fireEvent.keyDown(items[2], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[2]);
    fireEvent.keyDown(items[2], { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('closes with Escape and returns the focus to the button', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Acciones de vuelo LA800' });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getAllByRole('menuitem')[0], { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('runs the chosen action and closes', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Acciones de vuelo LA800' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Eliminar' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
