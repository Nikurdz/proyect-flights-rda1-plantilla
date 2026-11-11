import { enmascararCorreo, enmascararTelefono } from './enmascarar';

describe('enmascarar', () => {
  it('keeps the first letter and the domain of an e-mail', () => {
    expect(enmascararCorreo('david@gmail.com')).toBe('d***@gmail.com');
  });

  it('never returns the original address when it is malformed', () => {
    expect(enmascararCorreo('sin-arroba')).toBe('***');
    expect(enmascararCorreo('@dominio.com')).toBe('***');
  });

  it('keeps only the last three digits of a phone number', () => {
    expect(enmascararTelefono('+593 99 999 1234')).toBe('***234');
    expect(enmascararTelefono('12')).toBe('***');
  });
});
