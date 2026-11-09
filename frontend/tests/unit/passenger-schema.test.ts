import { describe, expect, it } from 'vitest';
import { buildPassengerFormSchema } from '../../src/features/checkout/passenger-schema';

const context = { firstFlightDay: '2026-12-01', lastFlightDay: '2026-12-01', international: false, today: '2026-11-09' };

const doc = (numero: string, tipo = 'PASSPORT', vencimiento = '') => ({ tipo, numero, vencimiento });

const person = (id: string, tipo: string, extra: Record<string, unknown> = {}) => ({
  id,
  tipo,
  nombres: 'Juan Carlos',
  apellidos: 'Perez',
  fechaNacimiento: '1990-05-05',
  genero: 'M',
  nacionalidad: 'EC',
  documento: doc('1710034065', 'NATIONAL_ID'),
  ...extra,
});
const contacto = { correo: 'a@b.com', telefono: '+593999999999' };

function issues(pasajeros: unknown[], ctx: Parameters<typeof buildPassengerFormSchema>[0] = context) {
  const result = buildPassengerFormSchema(ctx).safeParse({ pasajeros, contacto });
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}

describe('passenger form schema', () => {
  it('accepts a valid adult', () => {
    expect(issues([person('ADT-1', 'ADULT')])).toEqual([]);
  });

  it('checks the age of the type on the first flight (limits)', () => {
    expect(issues([person('ADT-1', 'YOUTH', { fechaNacimiento: '2008-12-01' })])).toEqual([expect.stringContaining('pasajeros.0.fechaNacimiento: Joven')]);
    expect(issues([person('ADT-1', 'ADULT', { fechaNacimiento: '2008-12-02' })])).toEqual([expect.stringContaining('fechaNacimiento')]);
    expect(issues([person('ADT-1', 'ADULT', { fechaNacimiento: '2008-12-01' })])).toEqual([]);
    expect(issues([person('ADT-1', 'CHILD', { fechaNacimiento: '2014-12-01' })])).toEqual([expect.stringContaining('Niño')]);
  });

  it('rejects an infant who turns 2 before the last flight', () => {
    const ctx = { ...context, lastFlightDay: '2026-12-20' };
    const baby = person('INF-1', 'INFANT', { asociadoA: 'ADT-1', fechaNacimiento: '2024-12-10', nombres: 'Bebe', documento: doc('BB12345') });
    expect(issues([person('ADT-1', 'ADULT'), baby], ctx)).toEqual([expect.stringContaining('El tipo cambia antes del último vuelo')]);
  });

  it('rejects future, impossible and over-120 birth dates', () => {
    expect(issues([person('ADT-1', 'ADULT', { fechaNacimiento: '2026-11-10' })])).toEqual([expect.stringContaining('futura')]);
    expect(issues([person('ADT-1', 'ADULT', { fechaNacimiento: '1990-02-30' })])).toEqual([expect.stringContaining('válida')]);
    expect(issues([person('ADT-1', 'ADULT', { fechaNacimiento: '1900-01-01' })])).toEqual([expect.stringContaining('120')]);
  });

  it('validates a Ecuadorian cédula but not other documents', () => {
    expect(issues([person('ADT-1', 'ADULT', { documento: doc('1710034066', 'NATIONAL_ID') })])).toEqual([expect.stringContaining('cédula')]);
    expect(issues([person('ADT-1', 'ADULT', { nacionalidad: 'CO', documento: doc('1710034066', 'NATIONAL_ID') })])).toEqual([]);
    expect(issues([person('ADT-1', 'ADULT', { documento: doc('A1234567') })])).toEqual([]);
  });

  it('requires the document expiry on international trips and after the last flight', () => {
    const intl = { ...context, international: true };
    expect(issues([person('ADT-1', 'ADULT')], intl)).toEqual([expect.stringContaining('documento.vencimiento')]);
    expect(issues([person('ADT-1', 'ADULT', { documento: doc('1710034065', 'NATIONAL_ID', '2026-12-01') })], intl)).toEqual([expect.stringContaining('después del último vuelo')]);
    expect(issues([person('ADT-1', 'ADULT', { documento: doc('1710034065', 'NATIONAL_ID', '2026-12-02') })], intl)).toEqual([]);
    // Domestic: optional, but when given it must still outlast the trip.
    expect(issues([person('ADT-1', 'ADULT', { documento: doc('1710034065', 'NATIONAL_ID', '2026-11-30') })])).toEqual([expect.stringContaining('después del último vuelo')]);
  });

  it('rejects repeated documents and repeated people', () => {
    const second = person('ADT-2', 'ADULT', { nombres: 'Ana', documento: doc('1710-034 065') });
    expect(issues([person('ADT-1', 'ADULT'), second])).toEqual([expect.stringContaining('documento.numero: Este documento')]);
    const twin = person('ADT-2', 'ADULT', { nombres: 'JUAN CARLOS', apellidos: 'perez', documento: doc('ZZ99999') });
    expect(issues([person('ADT-1', 'ADULT'), twin])).toEqual([expect.stringContaining('nombres: Esta persona')]);
  });

  it('needs a different adult for each infant', () => {
    const infant = (id: string, adult: string, number: string) =>
      person(id, 'INFANT', { asociadoA: adult, fechaNacimiento: '2026-01-10', nombres: id, documento: doc(number) });
    const adults = [person('ADT-1', 'ADULT'), person('ADT-2', 'ADULT', { nombres: 'Ana', documento: doc('AN12345') })];
    expect(issues([...adults, infant('INF-1', 'ADT-1', 'IN11111'), infant('INF-2', 'ADT-2', 'IN22222')])).toEqual([]);
    expect(issues([...adults, infant('INF-1', 'ADT-1', 'IN11111'), infant('INF-2', 'ADT-1', 'IN22222')])).toEqual([expect.stringContaining('asociadoA: Un adulto')]);
    expect(issues([...adults, infant('INF-1', 'NADIE', 'IN11111')])).toEqual([expect.stringContaining('asociadoA: Elige')]);
  });

  it('takes the adults from the API ids when the form keeps its own row keys', () => {
    const rows = [person('xyz', 'ADULT'), person('uvw', 'INFANT', { asociadoA: 'ADT-1', fechaNacimiento: '2026-01-10', nombres: 'Bebe', documento: doc('IN11111') })];
    expect(issues(rows, { ...context, ids: ['ADT-1', 'INF-1'] })).toEqual([]);
  });
});
