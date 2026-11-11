import { describe, expect, it } from 'vitest';
import { nextWithoutSeat, seatHolder, seatTraits, selectionsFromRegistered, toAsientosPayload, toggleSeat } from '../../src/lib/seats';

const LEG = 'leg-1';
const BACK = 'leg-2';

describe('seat selections', () => {
  it('picks, changes and clears a seat for one passenger', () => {
    let sel = toggleSeat({}, 'a1', LEG, '12A');
    expect(sel).toEqual({ a1: { [LEG]: '12A' } });

    sel = toggleSeat(sel, 'a1', LEG, '12B'); // changing the pick replaces it
    expect(sel).toEqual({ a1: { [LEG]: '12B' } });

    sel = toggleSeat(sel, 'a1', LEG, '12B'); // the same seat again clears it
    expect(sel).toEqual({});
  });

  it('keeps picks of different legs apart', () => {
    let sel = toggleSeat({}, 'a1', LEG, '3A');
    sel = toggleSeat(sel, 'a1', BACK, '4F');
    expect(sel.a1).toEqual({ [LEG]: '3A', [BACK]: '4F' });
    expect(toAsientosPayload(sel, 'a1')).toEqual([
      { trayectoId: LEG, asiento: '3A' },
      { trayectoId: BACK, asiento: '4F' },
    ]);
  });

  it('does not let a passenger take a seat another passenger holds', () => {
    const sel = toggleSeat({}, 'a1', LEG, '5C');
    expect(toggleSeat(sel, 'c1', LEG, '5C')).toBe(sel);
    expect(seatHolder(sel, LEG, '5C')).toBe('a1');
    expect(seatHolder(sel, BACK, '5C')).toBeUndefined(); // the same number on another leg is free
  });

  it('sends nothing for a passenger without a seat', () => {
    expect(toAsientosPayload({}, 'a1')).toBeUndefined();
  });

  it('moves on to the next passenger who still has no seat on the leg', () => {
    const ids = ['a1', 'a2', 'c1'];
    const sel = toggleSeat(toggleSeat({}, 'a1', LEG, '1A'), 'a2', LEG, '1B');
    expect(nextWithoutSeat(sel, ids, LEG, 'a2')).toBe('c1');
    const all = toggleSeat(sel, 'c1', LEG, '1C');
    expect(nextWithoutSeat(all, ids, LEG, 'c1')).toBe('c1'); // everyone has one: stay
  });

  it('restores the picks of a saved offer', () => {
    expect(
      selectionsFromRegistered([
        { id: 'a1', asientos: [{ trayectoId: LEG, asiento: '9D' }] },
        { id: 'c1' },
      ]),
    ).toEqual({ a1: { [LEG]: '9D' } });
    expect(selectionsFromRegistered(undefined)).toEqual({});
  });

  it('describes seat traits in Spanish', () => {
    expect(seatTraits(['WINDOW', 'EXTRA_LEGROOM'])).toBe('ventana, más espacio para las piernas');
    expect(seatTraits([])).toBe('');
  });
});
