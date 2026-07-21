import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceRule } from './price-rule.entity';
import { PricingEngineService } from './pricing-engine.service';
import { PricingController } from './pricing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PriceRule])],
  providers: [PricingEngineService],
  controllers: [PricingController],
  exports: [PricingEngineService],
})
export class PricingModule {}
