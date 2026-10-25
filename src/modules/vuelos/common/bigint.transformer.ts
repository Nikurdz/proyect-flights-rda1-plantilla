import type { ValueTransformer } from 'typeorm';

/** bigint columns come back as strings from the driver; money amounts here are far inside Number's safe range. */
export const bigintNumber: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null | undefined) => (value === null || value === undefined ? value : Number(value)),
};
