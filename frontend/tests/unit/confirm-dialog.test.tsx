// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { ConfirmDialog as LegacyPath } from '../../src/features/admin/ConfirmDialog';

afterEach(cleanup);

const setup = (props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <ConfirmDialog isOpen title="Cancelar el vuelo" confirmLabel="Cancelar vuelo" cancelLabel="Volver" onConfirm={onConfirm} onClose={onClose} {...props}>
      Se avisará a los pasajeros.
    </ConfirmDialog>
  );
  return { onConfirm, onClose };
};

describe('ConfirmDialog', () => {
  it('is a labelled dialog that explains what will happen', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Cancelar el vuelo' });
    expect(dialog.textContent).toContain('Se avisará a los pasajeros.');
  });

  it('confirms and cancels through their own buttons', () => {
    const { onConfirm, onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar vuelo' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('a destructive confirmation says it cannot be undone', () => {
    setup({ destructive: true });
    expect(screen.getByText(/no se puede deshacer/)).toBeTruthy();
  });

  it('disables both buttons while loading', () => {
    setup({ isLoading: true });
    expect((screen.getByRole('button', { name: 'Volver' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cancelar vuelo' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps the old import path working', () => {
    expect(LegacyPath).toBe(ConfirmDialog);
  });
});
