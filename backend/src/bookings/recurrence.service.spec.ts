import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { RecurrenceService, MAX_RECURRENCE_INSTANCES } from './recurrence.service';

describe('RecurrenceService', () => {
  let service: RecurrenceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RecurrenceService],
    }).compile();

    service = module.get<RecurrenceService>(RecurrenceService);
  });

  // ── expandInstances ────────────────────────────────────────────────────────

  describe('expandInstances', () => {
    const dtstart = new Date('2025-01-06T09:00:00Z'); // Monday
    const oneHourMs = 60 * 60 * 1000;

    it('weekly RRULE for 4 weeks expands to exactly 4 instances', () => {
      const instances = service.expandInstances(
        'FREQ=WEEKLY;COUNT=4',
        dtstart,
        oneHourMs,
      );

      expect(instances).toHaveLength(4);
    });

    it('first instance startTime equals dtstart', () => {
      const instances = service.expandInstances(
        'FREQ=WEEKLY;COUNT=4',
        dtstart,
        oneHourMs,
      );

      expect(instances[0].startTime.getTime()).toBe(dtstart.getTime());
    });

    it('each instance endTime = startTime + durationMs', () => {
      const durationMs = 2 * oneHourMs;
      const instances = service.expandInstances(
        'FREQ=WEEKLY;COUNT=4',
        dtstart,
        durationMs,
      );

      for (const instance of instances) {
        expect(instance.endTime.getTime() - instance.startTime.getTime()).toBe(
          durationMs,
        );
      }
    });

    it('weekly instances are spaced exactly 7 days apart', () => {
      const sevenDaysMs = 7 * 24 * oneHourMs;
      const instances = service.expandInstances(
        'FREQ=WEEKLY;COUNT=4',
        dtstart,
        oneHourMs,
      );

      for (let i = 1; i < instances.length; i++) {
        const gap =
          instances[i].startTime.getTime() -
          instances[i - 1].startTime.getTime();
        expect(gap).toBe(sevenDaysMs);
      }
    });

    it('biweekly (INTERVAL=2) instances are spaced 14 days apart', () => {
      const fourteenDaysMs = 14 * 24 * oneHourMs;
      const instances = service.expandInstances(
        'FREQ=WEEKLY;INTERVAL=2;COUNT=3',
        dtstart,
        oneHourMs,
      );

      expect(instances).toHaveLength(3);
      for (let i = 1; i < instances.length; i++) {
        const gap =
          instances[i].startTime.getTime() -
          instances[i - 1].startTime.getTime();
        expect(gap).toBe(fourteenDaysMs);
      }
    });

    it('monthly RRULE for 3 months expands to exactly 3 instances', () => {
      const instances = service.expandInstances(
        'FREQ=MONTHLY;COUNT=3',
        dtstart,
        oneHourMs,
      );

      expect(instances).toHaveLength(3);
    });

    it('accepts RRULE: prefix (RFC 5545 full form)', () => {
      const instances = service.expandInstances(
        'RRULE:FREQ=WEEKLY;COUNT=2',
        dtstart,
        oneHourMs,
      );

      expect(instances).toHaveLength(2);
    });

    it(`allows exactly ${MAX_RECURRENCE_INSTANCES} instances`, () => {
      const instances = service.expandInstances(
        `FREQ=WEEKLY;COUNT=${MAX_RECURRENCE_INSTANCES}`,
        dtstart,
        oneHourMs,
      );

      expect(instances).toHaveLength(MAX_RECURRENCE_INSTANCES);
    });

    it(`throws BadRequestException when COUNT exceeds ${MAX_RECURRENCE_INSTANCES}`, () => {
      expect(() =>
        service.expandInstances(
          `FREQ=WEEKLY;COUNT=${MAX_RECURRENCE_INSTANCES + 1}`,
          dtstart,
          oneHourMs,
        ),
      ).toThrow(BadRequestException);
    });

    it('throws BadRequestException for an invalid RRULE string', () => {
      expect(() =>
        service.expandInstances('NOT_A_VALID_RRULE', dtstart, oneHourMs),
      ).toThrow(BadRequestException);
    });

    it('throws BadRequestException when RRULE produces 0 occurrences (UNTIL in the past)', () => {
      // UNTIL is set to a date before dtstart
      expect(() =>
        service.expandInstances(
          'FREQ=WEEKLY;UNTIL=20000101T000000Z',
          dtstart,
          oneHourMs,
        ),
      ).toThrow(BadRequestException);
    });
  });

  // ── validateRule ──────────────────────────────────────────────────────────

  describe('validateRule', () => {
    it('returns parsed options for a valid RRULE', () => {
      const opts = service.validateRule('FREQ=WEEKLY;COUNT=4');
      expect(opts).toBeDefined();
    });

    it('throws BadRequestException for an invalid RRULE', () => {
      expect(() => service.validateRule('GARBAGE')).toThrow(BadRequestException);
    });
  });
});
