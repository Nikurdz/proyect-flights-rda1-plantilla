import { buildBoardingCode, buildTicketCode, verifyBoardingCode, verifyTicketCode } from './ticket-qr';

const SECRET = 'a-test-secret-with-more-than-32-characters';

describe('ticket QR code', () => {
  it('is deterministic and verifies back to the ticket it was built for', () => {
    const code = buildTicketCode(SECRET, '1234567890123', 'ABC234');
    expect(buildTicketCode(SECRET, '1234567890123', 'ABC234')).toBe(code);
    expect(code).toMatch(/^v1\.1234567890123\.ABC234\.[A-Za-z0-9_-]{22}$/);
    expect(verifyTicketCode(SECRET, code)).toEqual({ eTicketNumber: '1234567890123', pnr: 'ABC234' });
  });

  it('carries nothing but the e-ticket, the locator and the signature', () => {
    expect(buildTicketCode(SECRET, '1234567890123', 'ABC234').split('.')).toHaveLength(4);
  });

  it('rejects a code whose ticket or locator was altered', () => {
    const code = buildTicketCode(SECRET, '1234567890123', 'ABC234');
    expect(verifyTicketCode(SECRET, code.replace('1234567890123', '1234567890124'))).toBeNull();
    expect(verifyTicketCode(SECRET, code.replace('ABC234', 'ABC235'))).toBeNull();
  });

  it('rejects a code signed with another secret, and anything that is not a code', () => {
    const code = buildTicketCode(SECRET, '1234567890123', 'ABC234');
    expect(verifyTicketCode('another-secret-also-more-than-32-chars', code)).toBeNull();
    for (const junk of ['', 'hello', 'v2.1234567890123.ABC234.' + 'a'.repeat(22), 'v1.123.ABC234.' + 'a'.repeat(22), code + 'x']) {
      expect(verifyTicketCode(SECRET, junk)).toBeNull();
    }
  });
});
