import { describe, expect, it } from 'vitest';
import { buildSearchPath, describePassengers, outboundSelectionKey } from '../../src/lib/search';

const base = { origin: 'BOG', destination: 'SCL', outbound: '2026-10-14', trip: 'RT', adt: 2, chd: 0, inf: 1 };

describe('outboundSelectionKey', () => {
  it('ignores the return date, so changing it keeps the chosen outbound flight', () => {
    expect(outboundSelectionKey({ ...base })).toBe(outboundSelectionKey({ ...base }));
    // `inbound` is not even an input: the key cannot depend on it.
    expect(Object.keys(base)).not.toContain('inbound');
  });

  it('changes when anything that invalidates the outbound pick changes', () => {
    const key = outboundSelectionKey(base);
    expect(outboundSelectionKey({ ...base, outbound: '2026-10-15' })).not.toBe(key);
    expect(outboundSelectionKey({ ...base, destination: 'LIM' })).not.toBe(key);
    expect(outboundSelectionKey({ ...base, adt: 3 })).not.toBe(key);
    expect(outboundSelectionKey({ ...base, trip: 'OW' })).not.toBe(key);
  });
});

describe('buildSearchPath', () => {
  it('writes children and infants only when there are some', () => {
    const path = buildSearchPath({ origin: 'BOG', destination: 'MDE', outbound: '2026-10-12', trip: 'OW', passengers: { adt: 1, chd: 0, inf: 0 }, sort: 'MAS_BARATOS' });
    expect(path).toBe('/resultados?origin=BOG&destination=MDE&outbound=2026-10-12&trip=OW&adt=1&sort=MAS_BARATOS');
  });

  it('carries the chosen passengers', () => {
    const path = buildSearchPath({ origin: 'BOG', destination: 'MDE', outbound: '2026-10-12', trip: 'OW', passengers: { adt: 2, chd: 1, inf: 1 } });
    const query = new URLSearchParams(path.split('?')[1]);
    expect([query.get('adt'), query.get('chd'), query.get('inf')]).toEqual(['2', '1', '1']);
  });

  it('adds the return date only for round trips', () => {
    const rt = buildSearchPath({ origin: 'BOG', destination: 'MDE', outbound: '2026-10-12', inbound: '2026-10-19', trip: 'RT', passengers: { adt: 1, chd: 0, inf: 0 } });
    expect(rt).toContain('inbound=2026-10-19');
    const ow = buildSearchPath({ origin: 'BOG', destination: 'MDE', outbound: '2026-10-12', inbound: '2026-10-19', trip: 'OW', passengers: { adt: 1, chd: 0, inf: 0 } });
    expect(ow).not.toContain('inbound');
  });
});

describe('describePassengers', () => {
  it('uses singular and plural in Spanish', () => {
    expect(describePassengers({ adt: 1, chd: 0, inf: 0 })).toBe('1 adulto');
    expect(describePassengers({ adt: 2, chd: 1, inf: 1 })).toBe('2 adultos, 1 niño, 1 bebé');
    expect(describePassengers({ adt: 3, chd: 2, inf: 2 })).toBe('3 adultos, 2 niños, 2 bebés');
  });
});
