import { describe, expect, it } from 'vitest';
import {
  editFlightSchema,
  isoToUtcLocal,
  newFlightSchema,
  newUserSchema,
  rescheduleSchema,
  utcLocalToIso,
} from '../../src/features/admin/admin-schemas';

const validUser = { correo: 'ana@ram.com', contrasena: 'Clave12345', nombres: 'Ana', apellidos: 'Paz', fechaNacimiento: '1990-05-01' };

const future = () => new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 16);

const validFlight = () => ({
  codigoVuelo: 'la900',
  aerolinea: 'LATAM',
  origen: 'BOG',
  destino: 'SCL',
  salida: future(),
  duracionMinutos: '240',
  precioBaseUsd: '120.50',
  capacidad: '180',
});

describe('newUserSchema', () => {
  it('accepts a valid user', () => {
    expect(newUserSchema.safeParse({ ...validUser, telefono: '+593999999999' }).success).toBe(true);
  });

  it.each([
    ['short password', { contrasena: 'Ab1' }],
    ['password without number', { contrasena: 'SoloLetrasAqui' }],
    ['password without letter', { contrasena: '1234567890' }],
    ['bad email', { correo: 'nope' }],
    ['future birth date', { fechaNacimiento: '2999-01-01' }],
    ['bad phone', { telefono: '0999' }],
    ['empty names', { nombres: ' ' }],
  ])('rejects %s', (_name, patch) => {
    expect(newUserSchema.safeParse({ ...validUser, ...patch }).success).toBe(false);
  });
});

describe('newFlightSchema', () => {
  it('accepts a valid flight and uppercases the code', () => {
    const r = newFlightSchema.safeParse(validFlight());
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.codigoVuelo).toBe('LA900');
  });

  it.each([
    ['code without digits', { codigoVuelo: 'LAX' }],
    ['code too long', { codigoVuelo: 'LA12345' }],
    ['unknown airport', { origen: '' }],
    ['same origin and destination', { destino: 'BOG' }],
    ['past departure', { salida: '2020-01-01T10:00' }],
    ['duration too short', { duracionMinutos: '10' }],
    ['duration too long', { duracionMinutos: '1501' }],
    ['zero price', { precioBaseUsd: '0' }],
    ['three decimals', { precioBaseUsd: '10.123' }],
    ['capacity 401', { capacidad: '401' }],
    ['capacity 0', { capacidad: '0' }],
  ])('rejects %s', (_name, patch) => {
    expect(newFlightSchema.safeParse({ ...validFlight(), ...patch }).success).toBe(false);
  });

  it('allows an empty capacity (server default 180)', () => {
    expect(newFlightSchema.safeParse({ ...validFlight(), capacidad: '' }).success).toBe(true);
  });
});

describe('editFlightSchema and rescheduleSchema', () => {
  it('validates edits', () => {
    expect(editFlightSchema.safeParse({ aerolinea: 'LATAM', precioBaseUsd: '99', duracionMinutos: '90', capacidadTotal: '150' }).success).toBe(true);
    expect(editFlightSchema.safeParse({ aerolinea: 'L', precioBaseUsd: '99', duracionMinutos: '90', capacidadTotal: '150' }).success).toBe(false);
  });

  it('requires a future departure to reschedule', () => {
    expect(rescheduleSchema.safeParse({ nuevaSalida: future() }).success).toBe(true);
    expect(rescheduleSchema.safeParse({ nuevaSalida: '2020-01-01T10:00' }).success).toBe(false);
  });

  it('converts datetime-local values as UTC', () => {
    expect(utcLocalToIso('2030-03-04T05:06')).toBe('2030-03-04T05:06:00.000Z');
    expect(isoToUtcLocal('2030-03-04T05:06:00.000Z')).toBe('2030-03-04T05:06');
  });
});
