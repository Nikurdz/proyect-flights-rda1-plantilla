/** Helpers to point out the cheapest option of a list, computed from the data the API sent. */

const toNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(n) ? n : null;
};

/**
 * Position of the option with the lowest total, or -1 when there is nothing to compare
 * (fewer than two priced options, or every price is the same).
 */
export function lowestTotalIndex(totals: (string | number | null | undefined)[]): number {
  const priced = totals.map(toNumber);
  const valid = priced.filter((n): n is number => n !== null);
  if (valid.length < 2) return -1;
  const min = Math.min(...valid);
  if (valid.every((n) => n === min)) return -1;
  return priced.indexOf(min);
}

/**
 * Position of the option with the strictly lowest value (e.g. duration), or -1 when it is not unique
 * (a tie for first place) or there is nothing to compare. A badge «Más rápido» on tied flights is noise.
 */
export function uniqueMinIndex(values: (string | number | null | undefined)[]): number {
  const nums = values.map(toNumber);
  const valid = nums.filter((n): n is number => n !== null);
  if (valid.length < 2) return -1;
  const min = Math.min(...valid);
  if (valid.filter((n) => n === min).length !== 1) return -1;
  return nums.indexOf(min);
}

/** Position of the only flagged option, or -1 when none or several are flagged (the badge would repeat). */
export function onlyFlaggedIndex(flags: boolean[]): number {
  const first = flags.indexOf(true);
  return first >= 0 && flags.lastIndexOf(true) === first ? first : -1;
}

export interface GroupCounts {
  adt: number;
  yth: number;
  chd: number;
  inf: number;
}

/**
 * Group total from the per-adult price, in dollars. Adults and youths pay the adult fare, so the total is exact
 * when the group has no children or infants (their fare differs and is only known once a fare is chosen): null then.
 */
export function groupTotalFromAdultPrice(adultPrice: string | number | null | undefined, group: GroupCounts): number | null {
  const price = toNumber(adultPrice);
  if (price === null || group.chd > 0 || group.inf > 0) return null;
  return Math.round(price * (group.adt + group.yth) * 100) / 100;
}
