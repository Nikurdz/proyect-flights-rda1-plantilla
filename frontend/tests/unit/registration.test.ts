import { describe, it, expect } from 'vitest';
import { ageOn, registrationSchema } from '../../src/features/account/registration-schema';

const valid = {
  correo: 'ana@example.com',
  contrasena: 'Clave-segura-123',
  confirmacion: 'Clave-segura-123',
  nombres: 'Ana María',
  apellidos: 'Pérez Tapia',
  fechaNacimiento: '1990-04-01',
  telefono: '+593999999999',
  aceptaTerminos: true,
  consentimientoMarketing: false,
};

const problems = (input: Record<string, unknown>) => {
  const result = registrationSchema.safeParse({ ...valid, ...input });
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
};

describe('registration form rules', () => {
  it('accepts a complete, valid registration', () => {
    expect(registrationSchema.safeParse(valid).success).toBe(true);
  });

  it('keeps the phone optional but in international format when given', () => {
    expect(registrationSchema.safeParse({ ...valid, telefono: undefined }).success).toBe(true);
    expect(registrationSchema.safeParse({ ...valid, telefono: '' }).success).toBe(true);
    expect(problems({ telefono: '0999999999' })).toEqual([expect.stringContaining('telefono')]);
  });

  it('requires a password of 10+ characters with a letter and a number, repeated identically', () => {
    expect(problems({ contrasena: 'corta1', confirmacion: 'corta1' })).toEqual([expect.stringContaining('al menos 10')]);
    expect(problems({ contrasena: 'soloLetrasLargas', confirmacion: 'soloLetrasLargas' })).toEqual([expect.stringContaining('número')]);
    expect(problems({ contrasena: '12345678901', confirmacion: '12345678901' })).toEqual([expect.stringContaining('letra')]);
    expect(problems({ confirmacion: 'Otra-clave-456' })).toEqual([expect.stringContaining('no coinciden')]);
  });

  it('requires accepting the terms', () => {
    expect(problems({ aceptaTerminos: false })).toEqual([expect.stringContaining('aceptar')]);
  });

  it('requires an adult with a plausible birth date', () => {
    const today = new Date();
    const years = (n: number) => `${today.getFullYear() - n}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    expect(registrationSchema.safeParse({ ...valid, fechaNacimiento: years(18) }).success).toBe(true);
    expect(problems({ fechaNacimiento: years(17) })).toEqual([expect.stringContaining('mayor de 18')]);
    expect(problems({ fechaNacimiento: '' })).not.toEqual([]);
    expect(problems({ fechaNacimiento: '1850-01-01' })).not.toEqual([]);
  });

  it('computes whole years of age', () => {
    expect(ageOn('2000-06-15', new Date(2026, 5, 14))).toBe(25);
    expect(ageOn('2000-06-15', new Date(2026, 5, 15))).toBe(26);
  });
});
