import { Controller, Post, Body } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { BiometricService } from './biometric.service';
import {
  BiometricRegisterOptionsDto,
  BiometricRegisterVerifyDto,
  BiometricLoginOptionsDto,
  BiometricLoginVerifyDto,
} from './dto/biometric.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('biometric')
@Controller({ version: '1', path: 'auth/biometric' })
export class BiometricController {
  constructor(private readonly biometricService: BiometricService) {}

  @Post('register-options')
  @Public()
  @ApiOperation({ summary: 'Generate WebAuthn registration options' })
  @ApiResponse({
    status: 200,
    description: 'Registration options generated successfully',
  })
  async generateRegistrationOptions(@Body() dto: BiometricRegisterOptionsDto) {
    return this.biometricService.generateRegistrationOptions(dto.userId);
  }

  @Post('register-verify')
  @Public()
  @ApiOperation({ summary: 'Verify WebAuthn registration response' })
  @ApiResponse({
    status: 200,
    description: 'Registration verified and credential stored',
  })
  async verifyRegistration(@Body() dto: BiometricRegisterVerifyDto) {
    return this.biometricService.verifyRegistration(dto.userId, dto.attestationResponse);
  }

  @Post('login-options')
  @Public()
  @ApiOperation({ summary: 'Generate WebAuthn authentication options' })
  @ApiResponse({
    status: 200,
    description: 'Authentication options generated successfully',
  })
  async generateAuthenticationOptions(@Body() dto: BiometricLoginOptionsDto) {
    return this.biometricService.generateAuthenticationOptions(dto.userId);
  }

  @Post('login-verify')
  @Public()
  @ApiOperation({ summary: 'Verify WebAuthn authentication response and return JWT' })
  @ApiResponse({
    status: 200,
    description: 'Authentication verified, JWT returned',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        user: { type: 'object' },
      },
    },
  })
  async verifyAuthentication(@Body() dto: BiometricLoginVerifyDto) {
    return this.biometricService.verifyAuthentication(dto.userId, dto.assertionResponse);
  }
}
