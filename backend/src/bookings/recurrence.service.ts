import { Injectable, BadRequestException } from '@nestjs/common';
import { RRule } from 'rrule';

/** Maximum number of instances allowed per recurring series (1 year of weekly). */
export const MAX_RECURRENCE_INSTANCES = 52;

export interface RecurrenceInstance {
  startTime: Date;
  endTime: Date;
}

@Injectable()
export class RecurrenceService {
  /**
   * Expands an RFC 5545 RRULE string into concrete start/end time pairs.
   *
   * @param rruleString  - RFC 5545 RRULE string, e.g. "FREQ=WEEKLY;COUNT=4"
   * @param dtstart      - The start time of the first instance (used as DTSTART)
   * @param durationMs   - Duration of each instance in milliseconds
   * @returns Array of { startTime, endTime } pairs, capped at MAX_RECURRENCE_INSTANCES
   * @throws BadRequestException if the rule is invalid or produces 0 instances
   */
  expandInstances(
    rruleString: string,
    dtstart: Date,
    durationMs: number,
  ): RecurrenceInstance[] {
    let rule: RRule;

    try {
      // RRule.fromString expects the full "RRULE:FREQ=..." form or just "FREQ=..."
      const ruleText = rruleString.startsWith('RRULE:')
        ? rruleString.slice(6)
        : rruleString;

      rule = new RRule({
        ...RRule.parseString(ruleText),
        dtstart,
      });
    } catch {
      throw new BadRequestException(
        `Invalid RRULE string: "${rruleString}". Must be a valid RFC 5545 RRULE.`,
      );
    }

    // Expand up to MAX_RECURRENCE_INSTANCES + 1 so we can detect over-limit
    const occurrences = rule.all((_, len) => len <= MAX_RECURRENCE_INSTANCES);

    if (occurrences.length === 0) {
      throw new BadRequestException(
        'The provided RRULE produces no occurrences.',
      );
    }

    if (occurrences.length > MAX_RECURRENCE_INSTANCES) {
      throw new BadRequestException(
        `Recurring series exceeds the maximum of ${MAX_RECURRENCE_INSTANCES} instances. ` +
          `Use COUNT or UNTIL to limit the series.`,
      );
    }

    return occurrences.map((startTime) => ({
      startTime,
      endTime: new Date(startTime.getTime() + durationMs),
    }));
  }

  /**
   * Validates that an RRULE string is parseable without expanding it.
   * Returns the parsed rule options for inspection.
   */
  validateRule(rruleString: string): RRule.Options {
    try {
      const ruleText = rruleString.startsWith('RRULE:')
        ? rruleString.slice(6)
        : rruleString;
      return RRule.parseString(ruleText);
    } catch {
      throw new BadRequestException(
        `Invalid RRULE string: "${rruleString}". Must be a valid RFC 5545 RRULE.`,
      );
    }
  }
}
