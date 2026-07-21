import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TotpService } from './totp.service';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import {
  EnableTotpDto,
  VerifyTotpDto,
  DisableTotpDto,
  TotpSetupResponseDto,
  TotpStatusResponseDto,
} from './dto/totp.dto';

@ApiTags('auth/totp')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller({ version: '1', path: 'auth/totp' })
export class TotpController {
  constructor(
    private readonly totpService: TotpService,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('setup')
  @ApiOperation({
    summary: 'Generate TOTP setup credentials',
    description:
      'Generate a new TOTP secret and QR code for the user to scan with their authenticator app',
  })
  @ApiResponse({
    status: 200,
    description: 'TOTP setup credentials generated successfully',
    type: TotpSetupResponseDto,
  })
  async setupTotp(@Request() req: any): Promise<TotpSetupResponseDto> {
    const user = await this.usersService.findById(req.user.sub);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.totpEnabled) {
      throw new BadRequestException('TOTP is already enabled for this account');
    }

    const secret = this.totpService.generateSecret();
    const qrCodeUri = this.totpService.generateQrCodeUri(secret, user.email);

    return {
      secret,
      qrCodeUri,
      manualEntryKey: secret,
    };
  }

  @Post('enable')
  @ApiOperation({
    summary: 'Enable TOTP for the user account',
    description:
      'Verify the TOTP code and enable 2FA for the account. Returns backup codes for account recovery.',
  })
  @ApiResponse({
    status: 200,
    description: 'TOTP enabled successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        backupCodes: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async enableTotp(
    @Request() req: any,
    @Body() dto: EnableTotpDto,
  ): Promise<{ message: string; backupCodes: string[] }> {
    const user = await this.usersService.findById(req.user.sub);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.totpEnabled) {
      throw new BadRequestException('TOTP is already enabled for this account');
    }

    // The secret should be stored temporarily during setup
    // For now, we'll generate a new one and verify it
    const secret = this.totpService.generateSecret();

    // Verify the provided code against the secret
    const isValid = this.totpService.verifyToken(secret, dto.code);
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP code. Please try again.');
    }

    // Generate backup codes for account recovery
    const backupCodes = this.generateBackupCodes(10);

    // Update user with TOTP settings
    await this.usersService.update(req.user.sub, {
      totpEnabled: true,
      totpSecret: secret,
      backupCodes,
    });

    return {
      message: 'TOTP enabled successfully. Save your backup codes in a secure location.',
      backupCodes,
    };
  }

  @Post('verify')
  @ApiOperation({
    summary: 'Verify a TOTP code',
    description: 'Verify a TOTP code for login or other operations',
  })
  @ApiResponse({
    status: 200,
    description: 'TOTP code verified successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        valid: { type: 'boolean' },
      },
    },
  })
  async verifyTotp(
    @Request() req: any,
    @Body() dto: VerifyTotpDto,
  ): Promise<{ message: string; valid: boolean }> {
    const user = await this.usersService.findById(req.user.sub);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('TOTP is not enabled for this account');
    }

    const isValid = this.totpService.verifyToken(user.totpSecret, dto.code);
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    return {
      message: 'TOTP code verified successfully',
      valid: true,
    };
  }

  @Post('disable')
  @ApiOperation({
    summary: 'Disable TOTP for the user account',
    description: 'Disable 2FA by verifying the current TOTP code',
  })
  @ApiResponse({
    status: 200,
    description: 'TOTP disabled successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  async disableTotp(
    @Request() req: any,
    @Body() dto: DisableTotpDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findById(req.user.sub);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('TOTP is not enabled for this account');
    }

    // Verify the code before disabling
    const isValid = this.totpService.verifyToken(user.totpSecret, dto.code);
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP code. Cannot disable TOTP.');
    }

    // Disable TOTP
    await this.usersService.update(req.user.sub, {
      totpEnabled: false,
      totpSecret: null,
      backupCodes: null,
    });

    return {
      message: 'TOTP disabled successfully',
    };
  }

  @Get('status')
  @ApiOperation({
    summary: 'Get TOTP status for the user',
    description: 'Check if TOTP is enabled for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'TOTP status retrieved successfully',
    type: TotpStatusResponseDto,
  })
  async getTotpStatus(@Request() req: any): Promise<TotpStatusResponseDto> {
    const user = await this.usersService.findById(req.user.sub);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    return {
      totpEnabled: user.totpEnabled,
      // Don't return backup codes unless explicitly requested during setup
      backupCodes: undefined,
    };
  }

  /**
   * Generate backup codes for account recovery
   * These are single-use codes that can be used if the user loses access to their authenticator
   */
  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric codes
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }
}
