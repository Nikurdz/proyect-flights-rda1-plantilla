import { FieldCipher, encryptedJson } from '../../common/cifrado';
import { hashPassword, verifyPassword } from '../identidad/password.util';
import { Orden, TRANSICIONES } from '../ordenes/entities/orden.entity';
import { OrdenesService } from '../ordenes/ordenes.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { convertFromUsd, formatAmount, minorDigits, parseAmountMinor } from './moneda.util';
import { SlidingWindowLimiter } from './rate-limiter';
import { escapeLike, normalizarNombrePasajero, normalizarTexto } from './texto.util';

describe('moneda.util', () => {
  it('converts USD cents into the market currency using its own number of decimals', () => {
    expect(convertFromUsd(34270, 1, 'USD')).toBe(34270); // 342.70 USD
    expect(convertFromUsd(34270, 4000, 'COP')).toBe(1_370_800); // COP has no minor unit
    expect(convertFromUsd(1, 4000, 'COP')).toBe(40);
  });

  it('formats with the decimals of the currency', () => {
    expect(formatAmount(34270, 'USD')).toBe('342.70');
    expect(formatAmount(5, 'USD')).toBe('0.05');
    expect(formatAmount(1_370_800, 'COP')).toBe('1370800');
    expect(formatAmount(-250, 'USD')).toBe('-2.50');
    expect(minorDigits('XXX')).toBe(2); // unknown currencies default to cents
  });
});

describe('parseAmountMinor (A6)', () => {
  it('compares amounts, not spellings', () => {
    expect(parseAmountMinor('1234.5', 'USD')).toBe(123450);
    expect(parseAmountMinor('1234.50', 'USD')).toBe(123450);
    expect(parseAmountMinor('1234.500', 'USD')).toBe(123450);
    expect(parseAmountMinor('1234', 'USD')).toBe(123400);
  });

  it('rejects decimals a zero-decimal currency cannot express', () => {
    expect(parseAmountMinor('1371000', 'COP')).toBe(1371000);
    expect(parseAmountMinor('1371000.00', 'COP')).toBe(1371000);
    expect(parseAmountMinor('1371000.5', 'COP')).toBeNull();
    expect(parseAmountMinor('12.345', 'USD')).toBeNull();
  });

  it('rejects text that is not an amount', () => {
    for (const bad of ['', 'abc', '-5', '1,5', '1.', '.5']) expect(parseAmountMinor(bad, 'USD')).toBeNull();
  });
});

describe('texto.util', () => {
  it('normalises search text and passenger names', () => {
    expect(normalizarTexto('  Bogotá   EL Dorado ')).toBe('bogota el dorado');
    expect(normalizarNombrePasajero('José  Ñandú-Peña')).toBe('JOSE NANDU-PENA');
    expect(normalizarNombrePasajero('R2D2 !!')).toBe('R D');
    expect(normalizarNombrePasajero('12345')).toBe('');
  });

  it('escapes LIKE wildcards', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
});

describe('FieldCipher', () => {
  beforeAll(() => FieldCipher.configure(Buffer.alloc(32, 7)));

  it('round-trips, uses a fresh IV each time, and never stores plaintext', () => {
    const a = FieldCipher.encrypt('Peña Tapia');
    const b = FieldCipher.encrypt('Peña Tapia');
    expect(a).toMatch(/^v1:/);
    expect(a).not.toContain('Peña');
    expect(a).not.toBe(b);
    expect(FieldCipher.decrypt(a)).toBe('Peña Tapia');
  });

  it('detects tampering (GCM authentication) and unknown formats', () => {
    const [v, iv, tag, data] = FieldCipher.encrypt('secret').split(':');
    const flipped = Buffer.from(data, 'base64');
    flipped[0] ^= 0xff;
    expect(() => FieldCipher.decrypt([v, iv, tag, flipped.toString('base64')].join(':'))).toThrow();
    expect(() => FieldCipher.decrypt('plaintext')).toThrow();
  });

  it('decrypts nothing with a different key', () => {
    const encrypted = FieldCipher.encrypt('secret');
    FieldCipher.configure(Buffer.alloc(32, 9));
    expect(() => FieldCipher.decrypt(encrypted)).toThrow();
    FieldCipher.configure(Buffer.alloc(32, 7));
  });

  it('serialises JSON through the TypeORM transformer and keeps nulls as null', () => {
    const transformer = encryptedJson<{ a: number }>();
    const stored = transformer.to({ a: 1 }) as string;
    expect(stored).toMatch(/^v1:/);
    expect(transformer.from(stored)).toEqual({ a: 1 });
    expect(transformer.to(null)).toBeNull();
    expect(transformer.from(null)).toBeNull();
  });
});

describe('SlidingWindowLimiter', () => {
  it('allows up to the limit inside the window, then blocks until it slides', () => {
    const limiter = new SlidingWindowLimiter(2, 1000);
    expect(limiter.consume('ip', 0).allowed).toBe(true);
    expect(limiter.consume('ip', 100).allowed).toBe(true);
    const blocked = limiter.consume('ip', 200);
    expect(blocked).toEqual({ allowed: false, retryAfterSeconds: 1 });
    expect(limiter.consume('other', 200).allowed).toBe(true); // keys are independent
    expect(limiter.consume('ip', 1001).allowed).toBe(true); // the first hit slid out
  });
});

describe('password.util', () => {
  it('verifies the right password only, with a per-hash random salt', async () => {
    const a = await hashPassword('Correct-horse-9');
    const b = await hashPassword('Correct-horse-9');
    expect(a).not.toBe(b);
    expect(a).not.toContain('Correct-horse-9');
    expect(await verifyPassword('Correct-horse-9', a)).toBe(true);
    expect(await verifyPassword('correct-horse-9', a)).toBe(false);
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
  });
});

describe('order state machine (SRS §8.5)', () => {
  const service = new OrdenesService(undefined as never, undefined as never, undefined as never);
  const orden = (estado: Orden['estado']) => ({ estado, historial: [] }) as unknown as Orden;

  it('allows the documented path and records each step', () => {
    const o = orden('PENDIENTE_PAGO');
    service.transicionar(o, 'PAGADA', 'Pago autorizado');
    service.transicionar(o, 'EMITIDA');
    service.transicionar(o, 'EN_VIAJE');
    service.transicionar(o, 'COMPLETADA');
    expect(o.historial.map((h) => h.estado)).toEqual(['PAGADA', 'EMITIDA', 'EN_VIAJE', 'COMPLETADA']);
    expect(o.historial[0].motivo).toBe('Pago autorizado');
  });

  it('refuses transitions the model does not contain, and terminal states never leave', () => {
    expect(() => service.transicionar(orden('PAGADA'), 'COMPLETADA')).toThrow();
    expect(() => service.transicionar(orden('EMITIDA'), 'PAGADA')).toThrow();
    for (const terminal of ['REEMBOLSADA', 'COMPLETADA', 'EXPIRADA', 'FALLIDA_COMPENSADA'] as const) {
      expect(TRANSICIONES[terminal]).toEqual([]);
    }
  });
});

describe('notification templates', () => {
  const service = new NotificacionesService(undefined as never, undefined as never, undefined as never, undefined as never, undefined as never);

  it('substitutes placeholders literally and never expands a value that looks like one', () => {
    expect(service.renderizar('Hola {{nombre}}, orden {{numero}} {{ausente}}.', { nombre: '{{numero}}', numero: 'ORD-1' })).toBe('Hola {{numero}}, orden ORD-1 .');
  });
});
