import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { BiometricController } from './biometric.controller';
import { BiometricService } from './biometric.service';
import { TotpService } from './totp.service';
import { TotpController } from './totp.controller';
import { JwtStrategy } from './jwt.strategy';
import { EmailService } from './email.service';
import { RefreshToken } from './refresh-token.entity';
import { WebAuthnCredential } from './webauthn-credential.entity';
import { OAuthClient } from './oauth-client.entity';
import { RefreshTokenRepository } from './refresh-token.repository';
import { SessionBroadcastService } from './session-broadcast.service';
import { ForgotPasswordProvider } from '../users/providers/forgot-password.provider';
import { ResetPasswordProvider } from '../users/providers/reset-password.provider';
import { User } from '../users/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { OtpRateLimitService } from './otp-rate-limit.service';
import { TokenBlacklistModule } from '../common/modules/token-blacklist.module';
import { PasswordPolicyModule } from './password-policy/password-policy.module';
import { OAuthService } from './oauth.service';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    NotificationsModule,
    TokenBlacklistModule,
    PasswordPolicyModule,
    TypeOrmModule.forFeature([RefreshToken, WebAuthnCredential, User, OAuthClient]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '1h') },
      }),
    }),
  ],
  providers: [
    AuthService,
    BiometricService,
    TotpService,
    JwtStrategy,
    EmailService,
    RefreshTokenRepository,
    SessionBroadcastService,
    ForgotPasswordProvider,
    ResetPasswordProvider,
    OtpRateLimitService,
    OAuthService,
  ],
  controllers: [AuthController, BiometricController, TotpController],
  exports: [TotpService, OAuthService],
})
export class AuthModule {}
