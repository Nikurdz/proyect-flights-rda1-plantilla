/**
 * Card helpers for the (simulated) payment form. The number typed by the visitor is only used here,
 * in the browser, to recognise the brand and validate the shape: it is NEVER sent, stored or logged.
 * What reaches the API is a gateway token that only carries the brand and the outcome to simulate.
 */

export type CardBrand = 'VISA' | 'MASTERCARD' | 'AMEX' | 'DINERS';
export type DetectedBrand = CardBrand | 'UNSUPPORTED' | null;

export const ACCEPTED_BRANDS: CardBrand[] = ['VISA', 'MASTERCARD', 'AMEX', 'DINERS'];

export const BRAND_NAMES: Record<CardBrand, string> = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  AMEX: 'American Express',
  DINERS: 'Diners Club',
};

interface BrandRule {
  brand: CardBrand;
  /** Matches the digits typed so far. */
  prefix: RegExp;
  length: number;
  cvvLength: number;
  /** Group sizes for display, e.g. [4, 6, 5] -> "3782 822463 10005". */
  groups: number[];
}

const RULES: BrandRule[] = [
  { brand: 'AMEX', prefix: /^3[47]/, length: 15, cvvLength: 4, groups: [4, 6, 5] },
  { brand: 'DINERS', prefix: /^(36|30[0-5]|3095|38|39)/, length: 14, cvvLength: 3, groups: [4, 6, 4] },
  { brand: 'VISA', prefix: /^4/, length: 16, cvvLength: 3, groups: [4, 4, 4, 4] },
  { brand: 'MASTERCARD', prefix: /^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/, length: 16, cvvLength: 3, groups: [4, 4, 4, 4] },
];

// Brands that exist but are not sold here: recognised so the person gets a clear message.
const UNSUPPORTED = /^(6011|65|64[4-9]|35|62|81)/;

export const onlyDigits = (value: string): string => value.replace(/\D/g, '');

const ruleOf = (brand: DetectedBrand): BrandRule | undefined => RULES.find((rule) => rule.brand === brand);

export function detectBrand(input: string): DetectedBrand {
  const digits = onlyDigits(input);
  if (!digits) return null;
  const hit = RULES.find((rule) => rule.prefix.test(digits));
  if (hit) return hit.brand;
  return UNSUPPORTED.test(digits) ? 'UNSUPPORTED' : null;
}

export function cardLength(brand: DetectedBrand): number {
  return ruleOf(brand)?.length ?? 19;
}

export function cvvLength(brand: DetectedBrand): number {
  return ruleOf(brand)?.cvvLength ?? 3;
}

/** Groups the digits as the brand prints them, as the person types. */
export function formatCardNumber(input: string): string {
  const brand = detectBrand(input);
  const digits = onlyDigits(input).slice(0, cardLength(brand));
  const groups = ruleOf(brand)?.groups ?? [4, 4, 4, 4, 3];
  const parts: string[] = [];
  let index = 0;
  for (const size of groups) {
    if (index >= digits.length) break;
    parts.push(digits.slice(index, index + size));
    index += size;
  }
  return parts.join(' ');
}

/** Luhn checksum: what real card forms use to catch typos. */
export function passesLuhn(input: string): boolean {
  const digits = onlyDigits(input);
  if (digits.length < 12) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

/** "1228" -> "12/28": inserts the slash as the person types. */
export function formatExpiry(input: string): string {
  const digits = onlyDigits(input).slice(0, 4);
  if (digits.length === 0) return '';
  // A first digit above 1 can only be a month 02-09: pad it so "5" becomes "05".
  if (digits.length === 1 && Number(digits) > 1) return `0${digits}/`;
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/** Returns an error message, or null when the expiry is a real month that is not in the past. */
export function validateExpiry(value: string, now: Date = new Date()): string | null {
  const match = /^(\d{2})\/(\d{2})$/.exec(value);
  if (!match) return 'Usa el formato MM/AA.';
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return 'El mes no es válido.';
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (year < currentYear || (year === currentYear && month < currentMonth)) return 'La tarjeta está vencida.';
  if (year > currentYear + 20) return 'Revisa el año de vencimiento.';
  return null;
}

export interface CardErrors {
  number?: string;
  holder?: string;
  expiry?: string;
  cvv?: string;
}

export interface CardInput {
  number: string;
  holder: string;
  expiry: string;
  cvv: string;
}

export function validateCard(card: CardInput, now: Date = new Date()): CardErrors {
  const errors: CardErrors = {};
  const brand = detectBrand(card.number);
  const digits = onlyDigits(card.number);

  if (!digits) errors.number = 'Ingresa el número de tu tarjeta.';
  else if (brand === 'UNSUPPORTED') errors.number = 'Esta marca de tarjeta no está disponible. Usa Visa, Mastercard, American Express o Diners Club.';
  else if (!brand) errors.number = 'No reconocemos este número. Acepta Visa, Mastercard, American Express y Diners Club.';
  else if (digits.length !== cardLength(brand)) errors.number = `El número debe tener ${cardLength(brand)} dígitos.`;
  else if (!passesLuhn(digits)) errors.number = 'El número no es válido. Revisa que no tenga errores.';

  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]{3,60}$/.test(card.holder.trim())) errors.holder = 'Ingresa el nombre tal como aparece en la tarjeta.';

  const expiryError = validateExpiry(card.expiry, now);
  if (expiryError) errors.expiry = expiryError;

  const needed = cvvLength(brand);
  if (!new RegExp(`^\\d{${needed}}$`).test(card.cvv)) errors.cvv = `Son ${needed} dígitos.`;

  return errors;
}

export interface GatewayChoice {
  token: string;
  marca: CardBrand;
  /** What the simulation will do, for the test-number table. */
  outcome: 'approved' | 'declined' | 'insufficient' | 'expired' | 'fraud' | 'capture_fail';
}

/**
 * Special card numbers (the same idea as the test cards of real payment providers) make the
 * simulated gateway fail on purpose. Any other valid number is approved, whatever it is.
 */
export const TEST_NUMBERS: { number: string; outcome: GatewayChoice['outcome']; label: string; token: string }[] = [
  { number: '4000000000000002', outcome: 'declined', label: 'Rechazada por el banco', token: 'tok_declined' },
  { number: '4000000000009995', outcome: 'insufficient', label: 'Fondos insuficientes', token: 'tok_insufficient' },
  { number: '4000000000000069', outcome: 'expired', label: 'Tarjeta vencida', token: 'tok_expired' },
  { number: '4100000000000019', outcome: 'fraud', label: 'Bloqueo antifraude', token: 'tok_fraud' },
  { number: '4000000000000341', outcome: 'capture_fail', label: 'Aprobada, falla el cobro final', token: 'tok_visa_capture_fail' },
];

/** Quick-fill numbers that are approved, one per brand. */
export const APPROVED_TEST_NUMBERS: { brand: CardBrand; number: string }[] = [
  { brand: 'VISA', number: '4111111111111111' },
  { brand: 'MASTERCARD', number: '5555555555554444' },
  { brand: 'AMEX', number: '378282246310005' },
  { brand: 'DINERS', number: '36227206271667' },
];

/** Turns a validated number into the gateway token to send. Returns null if the brand is not sold. */
export function resolveGatewayChoice(number: string): GatewayChoice | null {
  const brand = detectBrand(number);
  if (!brand || brand === 'UNSUPPORTED') return null;
  const digits = onlyDigits(number);

  const special = TEST_NUMBERS.find((entry) => entry.number === digits);
  if (special) return { token: special.token, marca: brand, outcome: special.outcome };

  return { token: `tok_${brand.toLowerCase()}_ok`, marca: brand, outcome: 'approved' };
}
