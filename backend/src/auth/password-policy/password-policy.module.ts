import { Module } from '@nestjs/common';
import { PasswordPolicyService } from './password-policy.service';

@Module({
  providers: [PasswordPolicyService],
  exports: [PasswordPolicyService],
})
export class PasswordPolicyModule {}
