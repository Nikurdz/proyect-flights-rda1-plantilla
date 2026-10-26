import { describe, expect, it } from 'vitest';
import { ProblemDetailsError } from '../../src/api/problem-details';
import { consumesKey, estadoReserva, puedeCancelarReserva, reservaSchema, sinCancelacionGratis, todayIso, totalEstimado, validateTaxId } from '../../src/lib/experiencias';

const base = {
  fecha: '2999-01-15',
  hora: '10:30',
  cantidad: 2,
  nombre: 'Ana Paz',
  correo: 'ana@example.com',
  tipoIdentificacion: 'CEDULA',
  numeroIdentificacion: '1712345678',
  razonSocial: 'Ana Paz',
  direccion: 'Av. Amazonas 123',
  pais: 'EC',
};
const issues = (input: unknown) => {
  const r = reservaSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('reservaSchema', () => {
  it('accepts a complete booking and coerces the people count', () => {
    const r = reservaSchema.parse({ ...base, cantidad: '3' });
    expect(r.cantidad).toBe(3);
  });

  it('rejects a past date', () => {
    expect(issues({ ...base, fecha: '2020-01-01' })).toContain('La fecha no puede ser pasada.');
    expect(issues({ ...base, fecha: todayIso() })).toEqual([]);
  });

  it('keeps people between 1 and 10', () => {
    expect(issues({ ...base, cantidad: 0 })).toContain('Mínimo 1 persona.');
    expect(issues({ ...base, cantidad: 11 })).toContain('Máximo 10 personas por reserva.');
    expect(issues({ ...base, cantidad: 1.5 })).toContain('Usa un número entero.');
  });

  it('makes the time optional but strict when present', () => {
    expect(issues({ ...base, hora: '' })).toEqual([]);
    expect(issues({ ...base, hora: '25:00' })).toContain('Usa el formato HH:MM, por ejemplo 10:30.');
  });

  it('requires valid contact and billing data', () => {
    const out = issues({ ...base, nombre: 'A', correo: 'no-es-correo', numeroIdentificacion: 'ab#', razonSocial: '', direccion: '' });
    expect(out).toEqual(expect.arrayContaining(['Ingresa tu nombre completo.', 'Ingresa un correo válido.', 'Ingresa el nombre o razón social.', 'Ingresa la dirección fiscal.']));
    expect(out.some((m) => m.startsWith('Usa solo letras'))).toBe(true);
  });
});

describe('helpers', () => {
  it('computes the total in integer cents', () => {
    expect(totalEstimado({ moneda: 'USD', monto: '19.99' }, 3)).toEqual({ moneda: 'USD', monto: '59.97' });
    expect(totalEstimado({ moneda: 'USD', monto: '0.10' }, 3)).toEqual({ moneda: 'USD', monto: '0.30' });
  });

  it('checks the tax id against the market pattern, and never blocks on a broken pattern', () => {
    expect(validateTaxId('1712345678', '\\d{10}')).toBeNull();
    expect(validateTaxId('17123', '\\d{10}')).toBe('El número no corresponde al tipo de identificación elegido.');
    expect(validateTaxId('abc', undefined)).toBeNull();
    expect(validateTaxId('abc', '(')).toBeNull();
  });

  it('knows which errors burn the Idempotency-Key', () => {
    expect(consumesKey(new ProblemDetailsError({ status: 402, code: 'PAYMENT_DECLINED' }))).toBe(true);
    expect(consumesKey(new ProblemDetailsError({ status: 502, code: 'EXTERNAL_RESERVATION_FAILED_COMPENSATED' }))).toBe(true);
    expect(consumesKey(new ProblemDetailsError({ status: 409, code: 'PRICE_CHANGED' }))).toBe(true);
    expect(consumesKey(new ProblemDetailsError({ status: 503, code: 'SERVICE_UNAVAILABLE' }))).toBe(false);
    expect(consumesKey(new Error('x'))).toBe(false);
  });

  it('labels reservation states and allows cancelling only confirmed ones', () => {
    expect(estadoReserva('CONFIRMADA').label).toBe('Confirmada');
    expect(estadoReserva('FALLIDA_COMPENSADA').label).toBe('No realizada (sin cobro)');
    expect(estadoReserva('???').label).toBe('En proceso');
    expect(puedeCancelarReserva('CONFIRMADA', true)).toBe(true);
    expect(puedeCancelarReserva('CONFIRMADA', false)).toBe(false);
    expect(puedeCancelarReserva('CONFIRMADA', undefined)).toBe(false);
    expect(puedeCancelarReserva('CANCELADA', true)).toBe(false);
    expect(puedeCancelarReserva('FALLIDA_COMPENSADA', true)).toBe(false);
    expect(sinCancelacionGratis('CONFIRMADA', false)).toBe(true);
    expect(sinCancelacionGratis('CONFIRMADA', true)).toBe(false);
    expect(sinCancelacionGratis('CANCELADA', false)).toBe(false);
  });
});
