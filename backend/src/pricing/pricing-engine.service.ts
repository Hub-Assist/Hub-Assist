import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceRule } from './price-rule.entity';
import { CreatePriceRuleDto, UpdatePriceRuleDto, RateSegment, RateSnapshot } from './pricing.dto';
import { UserRole } from '../users/user.entity';

/**
 * Tier discount map.
 * Extend this when membership tiers are introduced beyond the current role enum.
 * Discount is a fraction subtracted from the gross cost (0.1 = 10 % off).
 */
const TIER_DISCOUNTS: Record<string, number> = {
  [UserRole.ADMIN]: 0.0,
  [UserRole.STAFF]: 0.15,
  [UserRole.MEMBER]: 0.1,
};

/**
 * PricingEngineService
 *
 * Responsibilities:
 *  1. CRUD for PriceRule records (admin only – enforced at controller layer).
 *  2. calculatePrice() – pure calculation, no DB writes.
 *
 * Pricing algorithm:
 *  - Split the booking window into 1-hour slots aligned to the clock.
 *  - For each slot, find the matching active PriceRule (dayOfWeek + hour range).
 *  - If no rule matches, fall back to workspace.pricePerHour.
 *  - Sum segment costs, then apply tier discount.
 *  - Return a RateSnapshot for auditability.
 */
@Injectable()
export class PricingEngineService {
  constructor(
    @InjectRepository(PriceRule)
    private readonly ruleRepo: Repository<PriceRule>,
  ) {}

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async createRule(dto: CreatePriceRuleDto): Promise<PriceRule> {
    this.validateRuleHours(dto.startHour, dto.endHour);
    await this.assertNoOverlap(dto.workspaceId, dto.dayOfWeek, dto.startHour, dto.endHour);
    const rule = this.ruleRepo.create({ ...dto, isActive: dto.isActive ?? true });
    return this.ruleRepo.save(rule);
  }

  async findRulesByWorkspace(workspaceId: string): Promise<PriceRule[]> {
    return this.ruleRepo.find({
      where: { workspaceId },
      order: { dayOfWeek: 'ASC', startHour: 'ASC' },
    });
  }

  async findRuleById(id: string): Promise<PriceRule> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException(`PriceRule ${id} not found`);
    return rule;
  }

  async updateRule(id: string, dto: UpdatePriceRuleDto): Promise<PriceRule> {
    const rule = await this.findRuleById(id);
    const merged = { ...rule, ...dto };
    this.validateRuleHours(merged.startHour, merged.endHour);

    // Re-check overlap only when time/day fields changed
    const timeChanged =
      dto.dayOfWeek !== undefined ||
      dto.startHour !== undefined ||
      dto.endHour !== undefined;

    if (timeChanged) {
      await this.assertNoOverlap(
        merged.workspaceId,
        merged.dayOfWeek,
        merged.startHour,
        merged.endHour,
        id, // exclude self
      );
    }

    Object.assign(rule, dto);
    return this.ruleRepo.save(rule);
  }

  async deleteRule(id: string): Promise<void> {
    const rule = await this.findRuleById(id);
    await this.ruleRepo.remove(rule);
  }

  // ─── Price Calculation ─────────────────────────────────────────────────────

  /**
   * Calculate the total booking cost and return a full rate snapshot.
   *
   * @param workspaceId  - workspace being booked
   * @param startTime    - booking start (UTC Date)
   * @param endTime      - booking end (UTC Date)
   * @param userTier     - UserRole of the booking user (drives discount)
   * @param fallbackRate - workspace.pricePerHour used when no rule matches
   * @param rules        - pre-loaded rules (pass to avoid extra DB round-trip inside a transaction)
   */
  async calculatePrice(
    workspaceId: string,
    startTime: Date,
    endTime: Date,
    userTier: string,
    fallbackRate: number,
    rules?: PriceRule[],
  ): Promise<RateSnapshot> {
    if (endTime <= startTime) {
      throw new BadRequestException('endTime must be after startTime');
    }

    const activeRules =
      rules ??
      (await this.ruleRepo.find({ where: { workspaceId, isActive: true } }));

    const segments = this.buildSegments(startTime, endTime, activeRules, fallbackRate);

    const grossTotal = segments.reduce((sum, s) => sum + s.segmentCost, 0);
    const tierDiscount = TIER_DISCOUNTS[userTier] ?? 0;
    const totalAmount = Number((grossTotal * (1 - tierDiscount)).toFixed(2));

    return {
      segments,
      totalAmount,
      userTier,
      tierDiscount,
      calculatedAt: new Date().toISOString(),
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Split [startTime, endTime] into sub-segments aligned to hour boundaries,
   * resolve the applicable rule for each, and return the cost breakdown.
   */
  private buildSegments(
    startTime: Date,
    endTime: Date,
    rules: PriceRule[],
    fallbackRate: number,
  ): RateSegment[] {
    const segments: RateSegment[] = [];

    // Walk through the booking in minute-precision slices aligned to hour boundaries
    let cursor = new Date(startTime);

    while (cursor < endTime) {
      // Next boundary: either the next full hour or endTime, whichever is sooner
      const nextHour = new Date(cursor);
      nextHour.setUTCMinutes(0, 0, 0);
      nextHour.setUTCHours(nextHour.getUTCHours() + 1);

      const sliceEnd = nextHour < endTime ? nextHour : endTime;
      const hours = (sliceEnd.getTime() - cursor.getTime()) / (1000 * 60 * 60);

      const rule = this.findMatchingRule(rules, cursor);
      const ratePerHour = rule ? Number(rule.ratePerHour) : fallbackRate;
      const segmentCost = Number((hours * ratePerHour).toFixed(6));

      segments.push({
        ruleId: rule?.id ?? 'fallback',
        label: rule?.label ?? 'Standard Rate',
        startTime: cursor.toISOString(),
        endTime: sliceEnd.toISOString(),
        hours: Number(hours.toFixed(6)),
        ratePerHour,
        segmentCost,
      });

      cursor = sliceEnd;
    }

    return segments;
  }

  /**
   * Find the first active rule whose dayOfWeek and [startHour, endHour) window
   * contains the given moment.
   */
  private findMatchingRule(rules: PriceRule[], moment: Date): PriceRule | undefined {
    const dow = moment.getUTCDay(); // 0 = Sunday
    const hour = moment.getUTCHours();

    return rules.find(
      (r) =>
        r.isActive &&
        r.dayOfWeek === dow &&
        r.startHour <= hour &&
        hour < r.endHour,
    );
  }

  private validateRuleHours(startHour: number, endHour: number): void {
    if (startHour >= endHour) {
      throw new BadRequestException('startHour must be less than endHour');
    }
  }

  /**
   * Ensure no existing active rule for the same workspace/dayOfWeek overlaps
   * the proposed [startHour, endHour) window.
   */
  private async assertNoOverlap(
    workspaceId: string,
    dayOfWeek: number,
    startHour: number,
    endHour: number,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.ruleRepo.find({
      where: { workspaceId, dayOfWeek, isActive: true },
    });

    const conflict = existing.find((r) => {
      if (excludeId && r.id === excludeId) return false;
      // Overlap: r.startHour < endHour AND r.endHour > startHour
      return r.startHour < endHour && r.endHour > startHour;
    });

    if (conflict) {
      throw new ConflictException(
        `PriceRule overlaps with existing rule "${conflict.label ?? conflict.id}" ` +
          `(${conflict.startHour}:00–${conflict.endHour}:00 on day ${conflict.dayOfWeek})`,
      );
    }
  }
}
