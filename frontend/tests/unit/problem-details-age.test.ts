import { describe, expect, it } from 'vitest';
import { ProblemDetailsError } from '../../src/api/problem-details';

describe('age errors of the passenger step', () => {
  const problems = (reason: string) =>
    new ProblemDetailsError({ status: 422, code: 'VALIDATION_FAILED', invalidParams: [{ name: 'pasajeros.fechaNacimiento', reason }] }).invalidParams;

  it('marks the birth date field and explains the age mismatch', () => {
    expect(problems('age 3 at the first flight does not match INFANT')).toEqual([
      { name: 'pasajeros.fechaNacimiento', label: 'Fecha de nacimiento', reason: expect.stringContaining('primer vuelo') },
    ]);
  });

  it('explains a type that changes before the last flight and a future birth date', () => {
    expect(problems('age 2 at the last flight does not match INFANT')[0].reason).toContain('último vuelo');
    expect(problems('must not be in the future')[0].reason).toContain('futura');
  });
});
