// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PassengerSelector, type PassengerCounts } from '../../src/features/search/PassengerSelector';

let latest: PassengerCounts;

const Harness: React.FC<{ start: PassengerCounts }> = ({ start }) => {
  const [counts, setCounts] = useState(start);
  const change = (next: PassengerCounts) => {
    latest = next;
    setCounts(next);
  };
  return <PassengerSelector counts={counts} onChange={change} />;
};

function open(start: PassengerCounts) {
  latest = start;
  render(<Harness start={start} />);
  fireEvent.click(screen.getByRole('button', { name: /adulto/i }));
}

const disabled = (label: string) => (screen.getByLabelText(label) as HTMLButtonElement).disabled;

afterEach(cleanup);

describe('PassengerSelector', () => {
  it('shows the youth counter and the 18+ adult text', () => {
    open({ adt: 1, yth: 0, chd: 0, inf: 0 });
    expect(screen.getByText('Joven (12 a 17 años)')).toBeTruthy();
    expect(screen.getByText('Desde 18 años')).toBeTruthy();
  });

  it('adds youths, who do not count towards the infant cap', () => {
    open({ adt: 1, yth: 0, chd: 0, inf: 0 });
    fireEvent.click(screen.getByLabelText('Sumar joven'));
    fireEvent.click(screen.getByLabelText('Sumar joven'));
    expect(latest.yth).toBe(2);
    fireEvent.click(screen.getByLabelText('Sumar bebé'));
    expect(latest.inf).toBe(1);
    // One adult, one infant: the second is refused whatever the youths.
    expect(disabled('Sumar bebé')).toBe(true);
  });

  it('drops infants when adults go down below them, but keeps youths', () => {
    open({ adt: 2, yth: 1, chd: 0, inf: 2 });
    fireEvent.click(screen.getByLabelText('Restar adulto'));
    expect(latest).toEqual({ adt: 1, yth: 1, chd: 0, inf: 1 });
  });

  it('stops at 9 passengers counting youths', () => {
    open({ adt: 3, yth: 3, chd: 2, inf: 1 });
    for (const label of ['Sumar adulto', 'Sumar joven', 'Sumar niño', 'Sumar bebé']) {
      expect(disabled(label)).toBe(true);
    }
    expect(screen.getByText(/Máximo 9 pasajeros/)).toBeTruthy();
  });
});
