import { IsString, IsEnum } from 'class-validator';

export enum GrantType {
  CLIENT_CREDENTIALS = 'client_credentials',
}

export class OAuthTokenDto {
  @IsEnum(GrantType)
  grant_type: GrantType;

  @IsString()
  client_id: string;

  @IsString()
  client_secret: string;
}

export class OAuthTokenResponseDto {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}
