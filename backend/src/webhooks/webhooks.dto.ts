import { ArrayNotEmpty, IsArray, IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';
import { SanitizeString } from '../common/transformers/sanitize-string.transformer';

export class CreateWebhookSubscriptionDto {
  @IsUrl({ require_tld: false, require_protocol: true })
  url: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  eventTypes: string[];

  @IsOptional()
  @SanitizeString()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
