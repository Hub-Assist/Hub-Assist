import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { SanitizeString } from '../../common/transformers/sanitize-string.transformer';

export class AddSpamKeywordDto {
  @SanitizeString()
  @IsString()
  keyword!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  weight?: number;
}
