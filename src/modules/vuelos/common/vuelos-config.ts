import { hkdfSync } from 'node:crypto';
import { ConfigService } from '@nestjs/config';

export const VUELOS_CONFIG = Symbol('VUELOS_CONFIG');

export interface VuelosConfig {
  /** Flat tax percentage in [0, 1). Stand-in for a real tax table (RN-07). */
  taxRate: number;
  /** ISO-4217 currency of the flight inventory prices (RN-14). */
  currency: string;
  offerTtlMinutes: number;
  holdTtlMinutes: number;
  /** Cap on leg combinations bundled into a single /search response. */
  maxOfferCombinations: number;
  /** RN-05: maximum passengers per order/booking (SRS open issue A-01). */
  maxPassengersPerOrder: number;
  /** HS256 signing secret shared with the identity service (no external IdP in RDA1). */
  jwtSecret: string;
  jwtTtlSeconds: number;
  /** AES-256 key for personal data at rest (RNF-18); 32 bytes. */
  dataEncryptionKey: Buffer;
}

function parseNumber(
  config: ConfigService,
  key: string,
  fallback: string,
  errors: string[],
  rule: (value: number) => boolean,
  expectation: string,
): number {
  const raw = config.get<string>(key, fallback);
  const value = Number(raw);
  if (raw === '' || !Number.isFinite(value) || !rule(value)) {
    errors.push(`${key}="${raw}" is invalid: expected ${expectation}`);
    return Number.NaN;
  }
  return value;
}

/**
 * Validates every Vuelos-specific env var once, at boot, so a typo fails fast with a
 * readable message instead of surfacing later as NaN prices or an Invalid Date expiry.
 */
export function loadVuelosConfig(config: ConfigService): VuelosConfig {
  const errors: string[] = [];
  const isPositiveInt = (v: number) => Number.isInteger(v) && v > 0;

  const taxRate = parseNumber(config, 'TAX_RATE', '0.15', errors, (v) => v >= 0 && v < 1, 'a number in [0, 1)');
  const offerTtlMinutes = parseNumber(config, 'OFFER_TTL_MINUTES', '15', errors, (v) => isPositiveInt(v) && v <= 1440, 'an integer in 1..1440');
  const holdTtlMinutes = parseNumber(config, 'HOLD_TTL_MINUTES', '15', errors, (v) => isPositiveInt(v) && v <= 1440, 'an integer in 1..1440');
  const maxOfferCombinations = parseNumber(config, 'OFFER_MAX_COMBINATIONS', '5', errors, (v) => isPositiveInt(v) && v <= 50, 'an integer in 1..50');
  const maxPassengersPerOrder = parseNumber(config, 'MAX_PASSENGERS_PER_ORDER', '9', errors, (v) => isPositiveInt(v) && v <= 50, 'an integer in 1..50');
  const jwtTtlSeconds = parseNumber(config, 'JWT_TTL_SECONDS', '3600', errors, (v) => isPositiveInt(v) && v <= 86_400, 'an integer in 1..86400');

  const currency = config.get<string>('DEFAULT_CURRENCY', 'USD');
  if (!/^[A-Z]{3}$/.test(currency)) {
    errors.push(`DEFAULT_CURRENCY="${currency}" is invalid: expected a 3-letter ISO-4217 code`);
  }

  const jwtSecret = config.get<string>('JWT_SECRET', '');
  if (jwtSecret.length < 32) {
    errors.push('JWT_SECRET is missing or shorter than 32 characters (set it in .env; see .env.example)');
  } else if (config.get<string>('NODE_ENV') === 'production' && jwtSecret.startsWith('change-me')) {
    errors.push('JWT_SECRET is still the placeholder from .env.example; set a real random secret in production');
  }

  // Personal data at rest: an explicit key in production; in development a key derived from
  // JWT_SECRET keeps the setup to one secret (HKDF, so the two uses never share raw material).
  let dataEncryptionKey = Buffer.alloc(0);
  const rawKey = config.get<string>('DATA_ENCRYPTION_KEY', '');
  if (rawKey) {
    dataEncryptionKey = Buffer.from(rawKey, 'base64');
    if (dataEncryptionKey.length !== 32) {
      errors.push('DATA_ENCRYPTION_KEY must be 32 bytes encoded as base64 (e.g. `openssl rand -base64 32`)');
    }
  } else if (config.get<string>('NODE_ENV') === 'production') {
    errors.push('DATA_ENCRYPTION_KEY is required in production (32 bytes, base64)');
  } else if (jwtSecret.length >= 32) {
    dataEncryptionKey = Buffer.from(hkdfSync('sha256', jwtSecret, '', 'vuelos-data-encryption', 32));
  }

  if (errors.length > 0) {
    throw new Error(`Invalid Vuelos configuration:\n - ${errors.join('\n - ')}`);
  }

  return {
    taxRate,
    currency,
    offerTtlMinutes,
    holdTtlMinutes,
    maxOfferCombinations,
    maxPassengersPerOrder,
    jwtSecret,
    jwtTtlSeconds,
    dataEncryptionKey,
  };
}
