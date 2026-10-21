// Money is carried as integer minor units (cents) in every calculation and only turned
// into the contract's "123.45" string at the API boundary, so float drift never reaches a
// stored or returned amount.

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export function toMinorUnits(amount: string | number): number {
  if (typeof amount === 'number') {
    // Columns of type numeric reach us as a JS number: settle it to two decimals first so a value such as
    // 1.005 * 100 cannot land on either side of the half-cent by float drift, then round once.
    return Math.round(Number(amount.toFixed(2)) * 100);
  }
  if (!MONEY_PATTERN.test(amount)) {
    throw new Error(`Invalid money amount "${amount}"`);
  }
  const [whole, fraction = ''] = amount.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function formatMinorUnits(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${fraction}`;
}

/** Multiplies minor units by a rate, rounding half away from zero. */
export function scaleMinorUnits(minor: number, rate: number): number {
  return Math.round(minor * rate);
}
