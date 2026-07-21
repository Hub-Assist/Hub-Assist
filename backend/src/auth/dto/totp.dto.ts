import { IsString, IsNotEmpty, Length, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EnableTotpDto {
  @ApiProperty({
    description: 'The TOTP code to verify (6 digits)',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'TOTP code must be exactly 6 digits' })
  code: string;
}

export class VerifyTotpDto {
  @ApiProperty({
    description: 'The TOTP code to verify (6 digits)',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'TOTP code must be exactly 6 digits' })
  code: string;
}

export class DisableTotpDto {
  @ApiProperty({
    description: 'The TOTP code to verify before disabling (6 digits)',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'TOTP code must be exactly 6 digits' })
  code: string;
}

export class TotpSetupResponseDto {
  @ApiProperty({
    description: 'The secret key for TOTP (base32 encoded)',
    example: 'JBSWY3DPEBLW64TMMQ======',
  })
  secret: string;

  @ApiProperty({
    description: 'QR code provisioning URI for scanning with authenticator apps',
    example:
      'otpauth://totp/HubAssist:user@example.com?secret=JBSWY3DPEBLW64TMMQ%3D%3D%3D%3D%3D%3D&issuer=HubAssist&algorithm=SHA1&digits=6&period=30',
  })
  qrCodeUri: string;

  @ApiProperty({
    description: 'Manual entry key (same as secret, for manual input)',
    example: 'JBSWY3DPEBLW64TMMQ======',
  })
  manualEntryKey: string;
}

export class TotpStatusResponseDto {
  @ApiProperty({
    description: 'Whether TOTP is enabled for the user',
    example: true,
  })
  totpEnabled: boolean;

  @ApiProperty({
    description: 'Backup codes for account recovery (only shown once during setup)',
    example: ['ABC123', 'DEF456', 'GHI789'],
    nullable: true,
  })
  backupCodes?: string[];
}
