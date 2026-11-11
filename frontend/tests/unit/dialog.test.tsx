// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Dialog } from '../../src/components/ui/Dialog';

// jsdom does no layout, so `offsetParent` is always null; the focus trap uses it to skip hidden controls.
const offsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() {
      return this.parentNode;
    },
  });
});
afterAll(() => {
  if (offsetParent) Object.defineProperty(HTMLElement.prototype, 'offsetParent', offsetParent);
});
afterEach(cleanup);

function Harness({ dismissible, onClose }: { dismissible?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <Dialog
        isOpen={open}
        dismissible={dismissible}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        title="Detalle"
        description="Texto de apoyo"
      >
        <button type="button">Primero</button>
        <button type="button">Último</button>
      </Dialog>
    </>
  );
}

const openDialog = () => {
  const trigger = screen.getByRole('button', { name: 'Abrir' });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
};

describe('Dialog', () => {
  it('is labelled by its title and description and puts the focus on the first control of the content', () => {
    render(<Harness />);
    openDialog();
    const dialog = screen.getByRole('dialog', { name: 'Detalle' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent).toBe('Texto de apoyo');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Primero' }));
  });

  it('traps Tab inside the dialog in both directions', () => {
    render(<Harness />);
    openDialog();
    const close = screen.getByRole('button', { name: 'Cerrar modal' });
    const last = screen.getByRole('button', { name: 'Último' });

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close); // wraps to the first focusable (the header close button)

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('closes with Escape and gives the focus back to the trigger', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const trigger = openDialog();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes with the close button, which is a type="button" with a 44 px target', () => {
    render(<Harness />);
    const trigger = openDialog();
    const close = screen.getByRole('button', { name: 'Cerrar modal' });
    expect(close.getAttribute('type')).toBe('button');
    expect(close.className).toContain('h-11');
    fireEvent.click(close);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps the content scrollable inside the viewport', () => {
    render(<Harness />);
    openDialog();
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-h-[85vh]');
    expect(dialog.querySelector('[data-dialog-content]')?.className).toContain('overflow-y-auto');
  });

  it('a required decision (dismissible=false) has no close button and ignores Escape', () => {
    const onClose = vi.fn();
    render(<Harness dismissible={false} onClose={onClose} />);
    openDialog();
    expect(screen.queryByRole('button', { name: 'Cerrar modal' })).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
