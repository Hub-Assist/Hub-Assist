import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'atLeastOneField', async: false })
export class AtLeastOneFieldConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    // Check if at least one field is defined and not undefined
    return Object.values(value).some((v) => v !== undefined);
  }

  defaultMessage(args: ValidationArguments): string {
    return 'At least one field must be provided in PATCH request';
  }
}

export function AtLeastOneField(validationOptions?: ValidationOptions) {
  return function (target: Object) {
    registerDecorator({
      target: target,
      options: validationOptions,
      constraints: [],
      validator: AtLeastOneFieldConstraint,
    });
  };
}
