import { buildBoardingCode, buildTicketCode, verifyBoardingCode, verifyTicketCode } from './ticket-qr';

const SECRET = 'a-test-secret-with-more-than-32-characters';

describe('boarding pass code', () => {
  it('is deterministic and verifies back to the ticket, flight and seat it names', () => {
    const code = buildBoardingCode(SECRET, '1234567890123', 'ABC234', 'LA800', '12A');
    expect(buildBoardingCode(SECRET, '1234567890123', 'ABC234', 'LA800', '12A')).toBe(code);
    expect(code).toMatch(/^bp1\.1234567890123\.ABC234\.LA800\.12A\.[A-Za-z0-9_-]{22}$/);
    expect(verifyBoardingCode(SECRET, code)).toEqual({ eTicketNumber: '1234567890123', pnr: 'ABC234', flightNumber: 'LA800', seat: '12A' });
  });

  it('cannot be moved to another flight or seat', () => {
    const code = buildBoardingCode(SECRET, '1234567890123', 'ABC234', 'LA800', '12A');
    expect(verifyBoardingCode(SECRET, code.replace('LA800', 'LA801'))).toBeNull();
    expect(verifyBoardingCode(SECRET, code.replace('.12A.', '.12B.'))).toBeNull();
  });

  it('is not a ticket code, and a ticket code is not a boarding pass', () => {
    const ticket = buildTicketCode(SECRET, '1234567890123', 'ABC234');
    expect(verifyBoardingCode(SECRET, ticket)).toBeNull();
    expect(verifyTicketCode(SECRET, buildBoardingCode(SECRET, '1234567890123', 'ABC234', 'LA800', '12A'))).toBeNull();
  });

  it('rejects another secret and junk', () => {
    const code = buildBoardingCode(SECRET, '1234567890123', 'ABC234', 'LA800', '12A');
    expect(verifyBoardingCode('another-secret-also-more-than-32-chars', code)).toBeNull();
    expect(verifyBoardingCode(SECRET, 'bp1.nonsense')).toBeNull();
  });
});
