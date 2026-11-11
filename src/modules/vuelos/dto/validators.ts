import { Transform } from 'class-transformer';
import { ValidationOptions, registerDecorator } from 'class-validator';
import { isDateOnly } from '../common/date.util';

/** A real calendar date written YYYY-MM-DD (the contract's `format: date`). */
export function IsDateOnly(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isDateOnly',
      target: target.constructor,
      propertyName: propertyKey as string,
      options: { message: `$property must be a valid calendar date (YYYY-MM-DD)`, ...validationOptions },
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isDateOnly(value),
      },
    });
  };
}

/** Trims and upper-cases string input before validation (IATA codes, locators, flight numbers). */
export const ToUpperTrimmed = (): PropertyDecorator =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value));

/** Trims and lower-cases string input (emails, market codes). */
export const ToLowerTrimmed = (): PropertyDecorator =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

export const E164_PHONE = /^\+[1-9]\d{6,14}$/;
