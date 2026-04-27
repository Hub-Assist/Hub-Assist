import { Injectable } from '@nestjs/common';
import { CreateUserProvider } from './providers/create-user.provider';
import { FindOneUserByIdProvider } from './providers/find-one-user-by-id.provider';
import { FindOneUserByEmailProvider } from './providers/find-one-user-by-email.provider';
import { FindAllUsersProvider } from './providers/find-all-users.provider';
import { FindAllAdminsProvider } from './providers/find-all-admins.provider';
import { FindAdminByIdProvider } from './providers/find-admin-by-id.provider';
import { UpdateUserProvider } from './providers/update-user.provider';
import { DeleteUserProvider } from './providers/delete-user.provider';
import { UploadProfilePictureProvider } from './providers/upload-profile-picture.provider';
import { ValidateUserProvider } from './providers/validate-user.provider';
import { ForgotPasswordProvider } from './providers/forgot-password.provider';
import { ResetPasswordProvider } from './providers/reset-password.provider';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    private createUserProvider: CreateUserProvider,
    private findOneUserByIdProvider: FindOneUserByIdProvider,
    private findOneUserByEmailProvider: FindOneUserByEmailProvider,
    private findAllUsersProvider: FindAllUsersProvider,
    private findAllAdminsProvider: FindAllAdminsProvider,
    private findAdminByIdProvider: FindAdminByIdProvider,
    private updateUserProvider: UpdateUserProvider,
    private deleteUserProvider: DeleteUserProvider,
    private uploadProfilePictureProvider: UploadProfilePictureProvider,
    private validateUserProvider: ValidateUserProvider,
    private forgotPasswordProvider: ForgotPasswordProvider,
    private resetPasswordProvider: ResetPasswordProvider,
  ) {}

  create(data: Partial<User>) {
    return this.createUserProvider.execute(data);
  }

  findById(id: string) {
    return this.findOneUserByIdProvider.execute(id);
  }

  findByEmail(email: string) {
    return this.findOneUserByEmailProvider.execute(email);
  }

  findAll(skip?: number, take?: number) {
    return this.findAllUsersProvider.execute(skip, take);
  }

  findAllAdmins(skip?: number, take?: number) {
    return this.findAllAdminsProvider.execute(skip, take);
  }

  findAdminById(id: string) {
    return this.findAdminByIdProvider.execute(id);
  }

  update(id: string, data: Partial<User>) {
    return this.updateUserProvider.execute(id, data);
  }

  delete(id: string) {
    return this.deleteUserProvider.execute(id);
  }

  updateProfilePicture(id: string, profilePictureUrl: string) {
    return this.uploadProfilePictureProvider.execute(id, profilePictureUrl);
  }

  validate(email: string, password: string) {
    return this.validateUserProvider.execute(email, password);
  }

  forgotPassword(email: string) {
    return this.forgotPasswordProvider.execute(email);
  }

  resetPassword(id: string, newPassword: string) {
    return this.resetPasswordProvider.execute(id, newPassword);
  }
}
