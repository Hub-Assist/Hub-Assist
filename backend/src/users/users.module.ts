import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserSearchService } from './services/user-search.service';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
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
import { ChangePasswordProvider } from './providers/change-password.provider';
import { TokenBlacklistModule } from '../common/modules/token-blacklist.module';
import { PasswordPolicyModule } from '../auth/password-policy/password-policy.module';
import { UserSubscriber } from './subscribers/user-subscriber';
import { Booking } from '../bookings/booking.entity';
import { RefreshToken } from '../auth/refresh-token.entity';
import { Attendance } from '../attendance/attendance.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Booking, RefreshToken, Attendance]),
    CloudinaryModule,
    TokenBlacklistModule,
    PasswordPolicyModule,
  ],
  providers: [
    UsersService,
    UserSearchService,
    CreateUserProvider,
    FindOneUserByIdProvider,
    FindOneUserByEmailProvider,
    FindAllUsersProvider,
    FindAllAdminsProvider,
    FindAdminByIdProvider,
    UpdateUserProvider,
    DeleteUserProvider,
    UploadProfilePictureProvider,
    ValidateUserProvider,
    ForgotPasswordProvider,
    ResetPasswordProvider,
    ChangePasswordProvider,
    UserSubscriber,
  ],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
