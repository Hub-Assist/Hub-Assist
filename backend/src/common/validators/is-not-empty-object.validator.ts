import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isNotEmptyObject', async: false })
export class IsNotEmptyObjectConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }
    return Object.keys(value).length > 0;
  }

  defaultMessage(): string {
    return 'PATCH body must not be empty';
  }
}

export function IsNotEmptyObject(validationOptions?: ValidationOptions) {
  return function (target: Object, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsNotEmptyObjectConstraint,
    });
  };
}
