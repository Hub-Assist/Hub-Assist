import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'atLeastOneField', async: false })
export class AtLeastOneFieldConstraint implements ValidatorConstraintInterface {
  validate(_value: any, args: ValidationArguments): boolean {
    const target = args.object;
    if (typeof target !== 'object' || target === null) {
      return false;
    }
    // Check if at least one field on the whole DTO is defined and not undefined
    return Object.values(target).some((v) => v !== undefined);
  }

  defaultMessage(args: ValidationArguments): string {
    return 'At least one field must be provided in PATCH request';
  }
}

// class-validator's registerDecorator is designed for property decorators, but
// this needs to validate the whole DTO object. We register it against a
// synthetic, non-existent property — class-validator invokes the constraint
// regardless of whether that property is actually present on the instance,
// and `args.object` (used above) gives the constraint access to the full DTO.
export function AtLeastOneField(validationOptions?: ValidationOptions) {
  return function (target: Function) {
    registerDecorator({
      target,
      propertyName: '__atLeastOneField',
      options: validationOptions,
      constraints: [],
      validator: AtLeastOneFieldConstraint,
    });
  };
}
