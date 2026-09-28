export interface FarePriceBreakdown {
  baseFare: number;
  taxes: number;
  total: number;
}

// RN-07: every quoted price includes taxes. There is no real tariff engine in this
// phase — taxRate is a flat configurable percentage (TAX_RATE env var), not a real tax
// table, and priceMultiplier stands in for fare-family-specific pricing rules.
export function computeFarePrice(
  basePrice: number,
  priceMultiplier: number,
  taxRate: number,
): FarePriceBreakdown {
  const baseFare = basePrice * priceMultiplier;
  const taxes = baseFare * taxRate;
  return { baseFare, taxes, total: baseFare + taxes };
}
