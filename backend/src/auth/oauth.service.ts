import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { OAuthClient } from './oauth-client.entity';
import { OAuthTokenDto, OAuthTokenResponseDto } from './dto/oauth-token.dto';

@Injectable()
export class OAuthService {
  constructor(
    @InjectRepository(OAuthClient)
    private oauthClientRepository: Repository<OAuthClient>,
    private jwtService: JwtService,
  ) {}

  async issueToken(dto: OAuthTokenDto): Promise<OAuthTokenResponseDto> {
    const client = await this.oauthClientRepository.findOne({
      where: { clientId: dto.client_id, isActive: true },
    });

    if (!client) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    const isValidSecret = await bcrypt.compare(dto.client_secret, client.clientSecretHash);
    if (!isValidSecret) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    const expiresIn = 3600; // 1 hour
    const accessToken = this.jwtService.sign(
      {
        clientId: client.id,
        scope: client.allowedScopes.join(' '),
        type: 'client',
      },
      { expiresIn },
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
      scope: client.allowedScopes.join(' '),
    };
  }

  async createClient(name: string, scopes: string[]): Promise<{ clientId: string; clientSecret: string }> {
    const clientId = uuidv4();
    const clientSecret = this.generateSecret();
    const clientSecretHash = await bcrypt.hash(clientSecret, 10);

    await this.oauthClientRepository.save({
      clientId,
      clientSecretHash,
      allowedScopes: scopes,
      name,
      isActive: true,
    });

    return { clientId, clientSecret };
  }

  async updateScopes(clientId: string, scopes: string[]): Promise<void> {
    await this.oauthClientRepository.update({ clientId }, { allowedScopes: scopes });
  }

  async deactivateClient(clientId: string): Promise<void> {
    await this.oauthClientRepository.update({ clientId }, { isActive: false });
  }

  async listClients(): Promise<OAuthClient[]> {
    return this.oauthClientRepository.find();
  }

  private generateSecret(): string {
    return require('crypto').randomBytes(32).toString('hex');
  }
}
