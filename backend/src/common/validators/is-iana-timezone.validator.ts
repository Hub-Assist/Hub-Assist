import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { IANAZone } from 'luxon';

@ValidatorConstraint({ name: 'isIANATimezone', async: false })
export class IsIANATimezoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return IANAZone.isValidZone(value);
  }

  defaultMessage(): string {
    return '$property must be a valid IANA timezone name (e.g. "America/New_York", "Europe/London")';
  }
}

/**
 * Validates that a string is a recognised IANA timezone identifier.
 * Uses Luxon's IANAZone.isValidZone() which checks against the full tz database.
 *
 * @example
 * \@IsIANATimezone()
 * timezone: string;
 */
export function IsIANATimezone(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: IsIANATimezoneConstraint,
    });
  };
}
