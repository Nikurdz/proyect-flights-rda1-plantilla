// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Stepper } from '../../src/components/ui/Stepper';

afterEach(cleanup);

const steps = [
  { id: 'pasajeros', label: 'Pasajeros' },
  { id: 'facturacion', label: 'Facturación' },
  { id: 'pago', label: 'Pago' },
];

describe('Stepper', () => {
  it('marks only the current step with aria-current="step"', () => {
    render(<Stepper steps={steps} current={1} />);
    const items = screen.getAllByRole('listitem');
    expect(items.map((i) => i.getAttribute('aria-current'))).toEqual([null, 'step', null]);
  });

  it('announces the step in a polite live region and updates when it changes', () => {
    const { rerender } = render(<Stepper steps={steps} current={0} />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('Paso 1 de 3: Pasajeros');
    rerender(<Stepper steps={steps} current={2} />);
    expect(screen.getByRole('status').textContent).toBe('Paso 3 de 3: Pago');
  });

  it('lets the person go back to a completed step only', () => {
    const onStepClick = vi.fn();
    render(<Stepper steps={steps} current={2} onStepClick={onStepClick} />);
    fireEvent.click(screen.getByRole('button', { name: /Pasajeros/ }));
    expect(onStepClick).toHaveBeenCalledWith(0);
    expect(screen.queryByRole('button', { name: /Pago/ })).toBeNull();
  });
});
