import { SetMetadata } from '@nestjs/common';

export const REQUIRE_SCOPE_KEY = 'require_scope';
export const RequireScope = (scope: string) => SetMetadata(REQUIRE_SCOPE_KEY, scope);
