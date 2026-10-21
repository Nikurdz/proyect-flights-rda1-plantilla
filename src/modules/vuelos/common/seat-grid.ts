export const SEAT_COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

const COLUMN_CHARACTERISTICS: Record<string, string[]> = {
  A: ['WINDOW'],
  B: [],
  C: ['AISLE'],
  D: ['AISLE'],
  E: [],
  F: ['WINDOW'],
};

export interface SeatDefinition {
  seatNumber: string;
  characteristics: string[];
}

export interface SeatRow {
  rowNumber: number;
  seats: SeatDefinition[];
}

export function rowCount(capacity: number): number {
  return Math.ceil(capacity / SEAT_COLUMNS.length);
}

/**
 * Deterministic single-aisle economy layout derived from the flight's capacity. There is no
 * persisted aircraft configuration in a direct-flights-only phase, so the grid is a pure
 * function of capacity; what is persisted is which seats are taken (SeatAssignment).
 */
export function buildSeatGrid(capacity: number): SeatRow[] {
  const rows = rowCount(capacity);
  return Array.from({ length: rows }, (_, index) => {
    const rowNumber = index + 1;
    return {
      rowNumber,
      seats: SEAT_COLUMNS.map((column) => {
        const characteristics = [...COLUMN_CHARACTERISTICS[column]];
        if (rowNumber === 1) characteristics.push('EXTRA_LEGROOM');
        if ((rowNumber === 12 || rowNumber === 13) && (column === 'A' || column === 'F')) {
          characteristics.push('EMERGENCY_EXIT');
        }
        return { seatNumber: `${rowNumber}${column}`, characteristics };
      }).slice(0, index === rows - 1 ? capacity - index * SEAT_COLUMNS.length : SEAT_COLUMNS.length),
    };
  });
}

export function seatExists(capacity: number, seatNumber: string): boolean {
  const match = /^(\d{1,3})([A-F])$/.exec(seatNumber);
  if (!match) return false;
  const row = Number(match[1]);
  const column = SEAT_COLUMNS.indexOf(match[2] as (typeof SEAT_COLUMNS)[number]);
  return row >= 1 && (row - 1) * SEAT_COLUMNS.length + column < capacity;
}
