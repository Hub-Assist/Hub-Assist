import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CursorPaginationQueryDto {
  /**
   * Opaque cursor token returned by the previous page response.
   * Omit (or leave empty) to fetch the first page.
   */
  @ApiPropertyOptional({
    description:
      'Opaque cursor token from the previous page `nextCursor` field. ' +
      'Omit to fetch the first page.',
    example: 'eyJ0aW1lc3RhbXAiOiIyMDI0LTAxLTAxVDAwOjAwOjAwLjAwMFoiLCJpZCI6InV1aWQifQ',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  /**
   * Maximum number of records to return per page (1–100, default 20).
   */
  @ApiPropertyOptional({
    description: 'Number of records per page (1–100).',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
