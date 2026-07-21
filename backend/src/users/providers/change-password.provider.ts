import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user.entity';
import * as bcrypt from 'bcrypt';
import { PasswordPolicyService } from '../../auth/password-policy/password-policy.service';

@Injectable()
export class ChangePasswordProvider {
  constructor(
    @InjectRepository(User) private repo: Repository<User>,
    private readonly passwordPolicyService: PasswordPolicyService,
  ) {}

  async execute(id: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }

    const policyResult = await this.passwordPolicyService.validate(newPassword);
    if (!policyResult.valid) {
      throw new BadRequestException({
        message: 'Password does not meet security requirements',
        violations: policyResult.violations,
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.repo.save(user);
    return { message: 'Password changed successfully' };
  }
}
