/**
 * Formats a monetary amount. The platform sells in US dollars only, shown as "$1,234.56".
 * The API sends amounts as strings with the decimals already applied; this only formats them.
 */
export function formatMoney(monto: string | number | undefined | null, moneda: string = 'USD'): string {
  if (monto === undefined || monto === null) return '-';

  const num = typeof monto === 'string' ? parseFloat(monto) : monto;
  if (Number.isNaN(num)) return '-';

  const currency = (moneda || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: currency === 'USD' ? 'narrowSymbol' : 'symbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency} ${num.toFixed(2)}`;
  }
}
