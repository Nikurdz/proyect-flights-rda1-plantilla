// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BoardingPass } from '../../src/components/ui/BoardingPass';

afterEach(cleanup);

const origin = { code: 'UIO', city: 'Quito', time: '07:00', date: 'lun 17 nov' };
const destination = { code: 'GYE', city: 'Guayaquil', time: '07:50' };

describe('BoardingPass', () => {
  it('shows both airport codes with their times, the duration and the details', () => {
    render(<BoardingPass origin={origin} destination={destination} duration="50 min" details="RAM Alliance · RA2500 · directo" />);
    const pass = screen.getByRole('article', { name: 'Vuelo UIO a GYE' });
    expect(within(pass).getByText('UIO')).toBeTruthy();
    expect(within(pass).getByText('07:00')).toBeTruthy();
    expect(within(pass).getByText('GYE')).toBeTruthy();
    expect(within(pass).getByText('07:50')).toBeTruthy();
    expect(within(pass).getByRole('img', { name: 'Duración 50 min' })).toBeTruthy();
    expect(pass.textContent).toContain('RA2500');
  });

  it('renders the stub content (price, button) inside the pass, behind a perforation', () => {
    render(<BoardingPass origin={origin} destination={destination} duration="50 min" stub={<button type="button">Elegir</button>} />);
    const pass = screen.getByRole('article');
    const button = within(pass).getByRole('button', { name: 'Elegir' });
    expect(pass.contains(button)).toBe(true);
    expect(pass.querySelector('.border-dashed')?.contains(button)).toBe(true);
    // The two perforation notches are decorative.
    expect(pass.querySelectorAll('span[aria-hidden="true"].rounded-full.absolute').length).toBe(2);
  });

  it('has no stub (and no perforation) when none is given', () => {
    render(<BoardingPass origin={origin} destination={destination} duration="50 min" />);
    expect(screen.getByRole('article').querySelector('.border-dashed')).toBeNull();
  });

  it('accepts a custom accessible name', () => {
    render(<BoardingPass origin={origin} destination={destination} duration="50 min" ariaLabel="Vuelo de ida" />);
    expect(screen.getByRole('article', { name: 'Vuelo de ida' })).toBeTruthy();
  });
});
