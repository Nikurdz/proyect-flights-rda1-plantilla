// Prices live in the flight inventory in USD (the GDS side). The e-commerce layer sells in the
// currency of the market the visitor entered (RN-01), converting with the market's configured
// rate. Amounts are integer minor units of that currency everywhere until formatting.

const MINOR_DIGITS: Record<string, number> = {
  USD: 2,
  EUR: 2,
  PEN: 2,
  BRL: 2,
  ARS: 2,
  MXN: 2,
  COP: 0,
  CLP: 0,
};

export function minorDigits(currency: string): number {
  return MINOR_DIGITS[currency] ?? 2;
}

/** USD cents -> minor units of `currency` at `rate` (units of currency per 1 USD). */
export function convertFromUsd(usdCents: number, rate: number, currency: string): number {
  return Math.round((usdCents / 100) * rate * 10 ** minorDigits(currency));
}

/** "1234.50" for 2-digit currencies, "1234500" for 0-digit ones (COP, CLP). */
export function formatAmount(minor: number, currency: string): string {
  const digits = minorDigits(currency);
  if (digits === 0) return String(Math.round(minor));
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minor));
  const factor = 10 ** digits;
  return `${sign}${Math.floor(abs / factor)}.${String(abs % factor).padStart(digits, '0')}`;
}

/**
 * "1234.5" / "1234.50" -> minor units, or null when the text is not an amount this currency can
 * express (more decimals than it has, e.g. "10.5" for COP). Compares amounts, not spellings.
 */
export function parseAmountMinor(text: string, currency: string): number | null {
  const match = /^(\d{1,12})(?:\.(\d+))?$/.exec(text.trim());
  if (!match) return null;
  const digits = minorDigits(currency);
  const fraction = match[2] ?? '';
  if (fraction.length > digits && /[1-9]/.test(fraction.slice(digits))) return null;
  return Number(match[1]) * 10 ** digits + (digits > 0 ? Number(fraction.slice(0, digits).padEnd(digits, '0')) : 0);
}

export interface MoneyView {
  moneda: string;
  monto: string;
}

export function money(minor: number, currency: string): MoneyView {
  return { moneda: currency, monto: formatAmount(minor, currency) };
}
