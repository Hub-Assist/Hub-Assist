import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from './booking.entity';
import { PriceRule } from '../pricing/price-rule.entity';
import { PricingEngineService } from '../pricing/pricing-engine.service';

/**
 * Handles pricing snapshot calculation and calculation for bookings.
 * Extracted from BookingsService to follow single responsibility principle.
 */
@Injectable()
export class BookingPricingService {
  constructor(
    @InjectRepository(Booking) private bookingRepo: Repository<Booking>,
    @InjectRepository(PriceRule) private priceRuleRepo: Repository<PriceRule>,
    private pricingEngine: PricingEngineService,
  ) {}

  /**
   * Calculate price snapshot for a booking time range.
   * Used during booking creation and updates.
   */
  async calculatePriceSnapshot(
    workspaceId: string,
    startTime: Date,
    endTime: Date,
    userTier: string,
    pricePerHour: number,
  ) {
    const rules = await this.priceRuleRepo.find({
      where: { workspaceId, isActive: true },
    });

    return this.pricingEngine.calculatePrice(
      workspaceId,
      startTime,
      endTime,
      userTier,
      pricePerHour,
      rules,
    );
  }

  /**
   * Calculate total amounts for all instances in a recurring series.
   * Returns array of amounts matching instance count.
   */
  async calculateSeriesPrices(
    workspaceId: string,
    instances: Array<{ startTime: Date; endTime: Date }>,
    userTier: string,
    pricePerHour: number,
  ): Promise<number[]> {
    const amounts: number[] = [];

    for (const instance of instances) {
      const snapshot = await this.calculatePriceSnapshot(
        workspaceId,
        instance.startTime,
        instance.endTime,
        userTier,
        pricePerHour,
      );
      amounts.push(snapshot.totalAmount);
    }

    return amounts;
  }
}
