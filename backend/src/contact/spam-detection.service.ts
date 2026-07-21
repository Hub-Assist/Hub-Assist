import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { SpamKeyword } from './spam-keyword.entity';
import { ContactMessage } from './contact-message.entity';

export interface SpamAnalysis {
  score: number;
  flags: string[];
}

/**
 * SpamDetectionService
 *
 * Calculates a heuristic spam score in [0, 1] for a contact submission.
 * The service is intentionally pure with respect to the ContactMessage entity
 * (no writes) — the caller decides what to do with the result.
 *
 * Scoring components:
 *  1. URL density  – penalises messages with many links
 *  2. Keyword hits – configurable list stored in spam_keywords table
 *  3. Message length – very short or very long messages are suspicious
 *  4. Repeated characters – e.g. "aaaaaaa" or "!!!!!!"
 *  5. Submission velocity – same IP within 10 minutes
 *
 * Threshold: score > 0.7 → flagged.
 */
@Injectable()
export class SpamDetectionService {
  private readonly logger = new Logger(SpamDetectionService.name);

  /** Spam flag threshold */
  static readonly SPAM_THRESHOLD = 0.7;

  /** URL regex – matches http/https/ftp links and bare www. domains */
  private static readonly URL_REGEX =
    /(?:https?:\/\/|ftp:\/\/|www\.)\S+/gi;

  /** Repeated-character run: 5+ identical chars in a row */
  private static readonly REPEATED_CHAR_REGEX = /(.)\1{4,}/g;

  constructor(
    @InjectRepository(SpamKeyword)
    private readonly keywordRepo: Repository<SpamKeyword>,
    @InjectRepository(ContactMessage)
    private readonly messageRepo: Repository<ContactMessage>,
  ) {}

  /**
   * Analyse a contact submission and return a score + flag list.
   * Does NOT write to the database.
   */
  async analyse(
    fullName: string,
    subject: string,
    message: string,
    ipAddress: string,
  ): Promise<SpamAnalysis> {
    const flags: string[] = [];
    let score = 0;

    const fullText = `${fullName} ${subject} ${message}`;

    // 1. URL density
    const urlMatches = fullText.match(SpamDetectionService.URL_REGEX) ?? [];
    const urlCount = urlMatches.length;
    if (urlCount >= 5) {
      const urlScore = Math.min(0.4, urlCount * 0.08);
      score += urlScore;
      flags.push(`HIGH_URL_DENSITY:${urlCount}`);
    } else if (urlCount >= 2) {
      score += urlCount * 0.05;
      flags.push(`URL_COUNT:${urlCount}`);
    }

    // 2. Keyword matches
    const keywords = await this.getActiveKeywords();
    const lowerText = fullText.toLowerCase();
    for (const kw of keywords) {
      if (lowerText.includes(kw.keyword.toLowerCase())) {
        score += kw.weight;
        flags.push(`SPAM_KEYWORD:${kw.keyword}`);
      }
    }

    // 3. Message length heuristic
    const msgLen = message.length;
    if (msgLen < 15) {
      score += 0.15;
      flags.push('MESSAGE_TOO_SHORT');
    } else if (msgLen > 4000) {
      score += 0.1;
      flags.push('MESSAGE_TOO_LONG');
    }

    // 4. Repeated characters
    const repeatedMatches = fullText.match(SpamDetectionService.REPEATED_CHAR_REGEX) ?? [];
    if (repeatedMatches.length > 0) {
      const repScore = Math.min(0.2, repeatedMatches.length * 0.05);
      score += repScore;
      flags.push(`REPEATED_CHARS:${repeatedMatches.length}`);
    }

    // 5. Submission velocity (same IP within 10 minutes)
    if (ipAddress && ipAddress !== 'unknown') {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const recentCount = await this.messageRepo.count({
        where: {
          ipAddress,
          createdAt: MoreThan(tenMinutesAgo),
        },
      });

      if (recentCount >= 3) {
        score += 0.3;
        flags.push(`HIGH_VELOCITY:${recentCount}_in_10min`);
      } else if (recentCount >= 1) {
        score += recentCount * 0.05;
        flags.push(`VELOCITY:${recentCount}_in_10min`);
      }
    }

    // Clamp to [0, 1]
    const finalScore = Math.min(1, Math.max(0, score));

    this.logger.debug(
      `Spam analysis: score=${finalScore.toFixed(3)} flags=[${flags.join(', ')}]`,
    );

    return { score: finalScore, flags };
  }

  isSpam(score: number): boolean {
    return score > SpamDetectionService.SPAM_THRESHOLD;
  }

  // ─── Keyword management (used by admin endpoints) ──────────────────────────

  async getActiveKeywords(): Promise<SpamKeyword[]> {
    return this.keywordRepo.find({ where: { isActive: true } });
  }

  async getAllKeywords(): Promise<SpamKeyword[]> {
    return this.keywordRepo.find({ order: { keyword: 'ASC' } });
  }

  async addKeyword(keyword: string, weight = 0.2): Promise<SpamKeyword> {
    const existing = await this.keywordRepo.findOne({
      where: { keyword: keyword.toLowerCase() },
    });
    if (existing) {
      existing.isActive = true;
      existing.weight = weight;
      return this.keywordRepo.save(existing);
    }
    const kw = this.keywordRepo.create({
      keyword: keyword.toLowerCase(),
      weight,
      isActive: true,
    });
    return this.keywordRepo.save(kw);
  }

  async removeKeyword(id: string): Promise<void> {
    await this.keywordRepo.delete(id);
  }
}
