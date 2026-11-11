import { describe, it, expect } from 'vitest';
import { ProblemDetailsError, fieldLabel, getFriendlyErrorMessage } from '../../src/api/problem-details';

describe('problem details handling', () => {
  it('translates known error codes into actionable Spanish messages', () => {
    expect(getFriendlyErrorMessage('VALIDATION_FAILED')).toContain('no son válidos');
    expect(getFriendlyErrorMessage('PAYMENT_DECLINED')).toContain('rechazó el pago');
    expect(getFriendlyErrorMessage('PRICE_CHANGED')).toContain('precio cambió');
    expect(getFriendlyErrorMessage('OFFER_EXPIRED')).toContain('terminó');
    expect(getFriendlyErrorMessage('ISSUANCE_FAILED_COMPENSATED')).toContain('no se te cobró');
  });

  it('never shows the backend detail: unknown codes get a generic message by status', () => {
    expect(getFriendlyErrorMessage('SOMETHING_NEW', 500)).toContain('de nuestro lado');
    expect(getFriendlyErrorMessage(undefined, 404)).toContain('No encontramos');
    expect(getFriendlyErrorMessage(undefined, 429)).toContain('muchas solicitudes');
    const error = new ProblemDetailsError({ status: 500, code: 'WHATEVER', detail: 'QueryFailedError: relation "x" does not exist' });
    expect(error.message).not.toContain('QueryFailedError');
  });

  it('keeps status, code, correlation id and translated field problems', () => {
    const error = new ProblemDetailsError(
      {
        status: 422,
        code: 'VALIDATION_FAILED',
        detail: 'Detalle técnico',
        invalidParams: [
          { name: 'contacto.correo', reason: 'correo must be an email' },
          { name: 'pasajeros.0.fechaNacimiento', reason: 'must be in the past' },
        ],
      },
      'corr-uuid-1234',
    );

    expect(error.status).toBe(422);
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.correlationId).toBe('corr-uuid-1234');
    expect(error.invalidParams).toHaveLength(2);
    expect(error.invalidParams[0]).toMatchObject({ name: 'contacto.correo', label: 'Correo electrónico', reason: 'Ingresa un correo válido.' });
    expect(error.invalidParams[1].label).toBe('Fecha de nacimiento');
    expect(error.invalidParams[1].reason).toBe('Debe ser una fecha pasada.');
  });

  it('labels fields in Spanish and falls back to a neutral label', () => {
    expect(fieldLabel('contrasena')).toBe('Contraseña');
    expect(fieldLabel('algo.raro')).toBe('Dato');
  });
});
