import 'reflect-metadata';

/**
 * Mark a DTO property as exempt from the global sanitization pipeline.
 * Use this for fields whose values must not be altered before storage,
 * such as hash values, tokens, or raw binary data.
 *
 * @example
 * class RefreshTokenDto {
 *   @NoSanitize()
 *   @IsString()
 *   refreshToken: string;
 * }
 */
export const NO_SANITIZE_KEY = 'hubassist:noSanitize';

export function NoSanitize(): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata(NO_SANITIZE_KEY, true, target, propertyKey);
  };
}
