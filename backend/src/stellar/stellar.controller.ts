import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { StellarService } from './stellar.service';

class VerifyTxDto {
  @IsString()
  txHash!: string;
}

@ApiTags('stellar')
@ApiBearerAuth('bearer')
@Controller({ version: '1', path: 'stellar' })
export class StellarController {
  constructor(private service: StellarService) {}

  @Post('verify-tx')
  @ApiOperation({ summary: 'Verify a Stellar transaction by hash' })
  @ApiResponse({ status: 200, description: 'Transaction verification result' })
  verifyTx(@Body() dto: VerifyTxDto) {
    return this.service.verifyTransaction(dto.txHash);
  }
}
