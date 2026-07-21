import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { WebAuthnCredential } from './webauthn-credential.entity';
import { User } from '../users/user.entity';

@Injectable()
export class BiometricService {
  private readonly rpName = 'HubAssist';
  private readonly rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
  private readonly origin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000';

  constructor(
    @InjectRepository(WebAuthnCredential)
    private credentialRepository: Repository<WebAuthnCredential>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async generateRegistrationOptions(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

     const options = await generateRegistrationOptions({
       rpName: this.rpName,
       rpID: this.rpID,
       userID: new TextEncoder().encode(userId),
       userName: user.email,
       userDisplayName: user.email,
       attestationType: 'direct',
     });

    return options;
  }

  async verifyRegistration(userId: string, attestationResponse: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    let attestation;
    try {
      attestation = JSON.parse(attestationResponse);
    } catch {
      throw new BadRequestException('Invalid attestation response');
    }

    try {
      const verification = await verifyRegistrationResponse({
        response: attestation,
        expectedChallenge: attestation.clientDataJSON?.challenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
      });

      if (!verification.verified) {
        throw new BadRequestException('Registration verification failed');
      }

      const credentialInfo = verification.registrationInfo!.credential;
      const credentialId = credentialInfo.id; // base64url string
      const publicKey = Buffer.from(credentialInfo.publicKey).toString('base64');
      const counter = credentialInfo.counter;

      const credential = this.credentialRepository.create({
        userId,
        credentialId,
        publicKey,
        counter,
      });

      await this.credentialRepository.save(credential);

      return { success: true, message: 'Biometric registration successful' };
    } catch (error) {
      throw new BadRequestException(`Registration verification failed: ${error}`);
    }
  }

  async generateAuthenticationOptions(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const credentials = await this.credentialRepository.find({ where: { userId } });
    if (credentials.length === 0) {
      throw new BadRequestException('No biometric credentials registered for this user');
    }

    const allowCredentials = credentials.map((cred) => ({
      id: cred.credentialId,
      transports: ['usb', 'nfc', 'ble', 'internal'] as AuthenticatorTransportFuture[],
    }));

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials,
    });

    return options;
  }

  async verifyAuthentication(userId: string, assertionResponse: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    let assertion;
    try {
      assertion = JSON.parse(assertionResponse);
    } catch {
      throw new BadRequestException('Invalid assertion response');
    }

    const credentialId = assertion.id;
    const credential = await this.credentialRepository.findOne({
      where: { userId, credentialId },
    });

    if (!credential) {
      throw new UnauthorizedException('Credential not found');
    }

    try {
      const verification = await verifyAuthenticationResponse({
        response: assertion,
        expectedChallenge: assertion.clientDataJSON?.challenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        credential: {
          id: credential.credentialId,
          publicKey: Buffer.from(credential.publicKey, 'base64'),
          counter: Number(credential.counter),
          transports: ['usb', 'nfc', 'ble', 'internal'],
        },
      });

      if (!verification.verified) {
        throw new UnauthorizedException('Authentication verification failed');
      }

      // Update counter
      credential.counter = verification.authenticationInfo!.newCounter;
      await this.credentialRepository.save(credential);

      // Generate JWT
      const token = this.jwtService.sign({
        sub: userId,
        email: user.email,
        role: user.role,
      });

      return { accessToken: token, user };
    } catch (error) {
      throw new UnauthorizedException(`Authentication verification failed: ${error}`);
    }
  }
}
