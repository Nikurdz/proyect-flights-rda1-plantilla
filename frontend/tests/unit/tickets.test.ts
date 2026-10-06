import { describe, expect, it } from 'vitest';
import { ticketStateLabel, ticketVerificationUrl } from '../../src/lib/tickets';

describe('ticket QR link', () => {
  it('points at the public check page with the signed code', () => {
    expect(ticketVerificationUrl('v1.1234567890123.ABC234.abc_DEF-ghijklmnopqrstu', 'https://ram-alliance.netlify.app')).toBe(
      'https://ram-alliance.netlify.app/verificar/v1.1234567890123.ABC234.abc_DEF-ghijklmnopqrstu',
    );
  });
});

describe('ticketStateLabel', () => {
  it('names the states a traveller can meet in Spanish', () => {
    expect(ticketStateLabel('ISSUED')).toBe('Emitido');
    expect(ticketStateLabel('VOIDED')).toBe('Anulado');
    expect(ticketStateLabel(undefined)).toBe('En proceso');
  });
});
