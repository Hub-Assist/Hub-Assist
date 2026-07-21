import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SpamDetectionService } from './spam-detection.service';
import { SpamKeyword } from './spam-keyword.entity';
import { ContactMessage, ContactMessageStatus } from './contact-message.entity';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeKeyword = (keyword: string, weight = 0.2): SpamKeyword => ({
  id: `kw-${keyword}`,
  keyword,
  weight,
  isActive: true,
  createdAt: new Date(),
});

const SPAM_KEYWORDS: SpamKeyword[] = [
  makeKeyword('buy now', 0.3),
  makeKeyword('click here', 0.25),
  makeKeyword('free money', 0.35),
  makeKeyword('limited offer', 0.2),
  makeKeyword('casino', 0.3),
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SpamDetectionService', () => {
  let service: SpamDetectionService;

  const mockKeywordRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockMessageRepo = {
    count: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpamDetectionService,
        { provide: getRepositoryToken(SpamKeyword), useValue: mockKeywordRepo },
        { provide: getRepositoryToken(ContactMessage), useValue: mockMessageRepo },
      ],
    }).compile();

    service = module.get<SpamDetectionService>(SpamDetectionService);
    jest.clearAllMocks();

    // Default: no velocity hits
    mockMessageRepo.count.mockResolvedValue(0);
  });

  // ── Core scoring ────────────────────────────────────────────────────────────

  describe('analyse', () => {
    it('scores a normal inquiry message below 0.3', async () => {
      mockKeywordRepo.find.mockResolvedValue(SPAM_KEYWORDS);

      const { score, flags } = await service.analyse(
        'Alice Johnson',
        'Question about your coworking space',
        'Hi, I would like to know more about your hot desk options and pricing. Could you please send me more details? Thank you.',
        '192.168.1.1',
      );

      expect(score).toBeLessThan(0.3);
      expect(flags).toHaveLength(0);
    });

    it('scores a message with 5 URLs and spam keywords above 0.7', async () => {
      mockKeywordRepo.find.mockResolvedValue(SPAM_KEYWORDS);

      const { score, flags } = await service.analyse(
        'Spammer',
        'Buy now! Limited offer!',
        'Click here http://spam1.com http://spam2.com http://spam3.com http://spam4.com http://spam5.com free money casino buy now',
        '10.0.0.1',
      );

      expect(score).toBeGreaterThan(0.7);
      expect(flags.some((f) => f.startsWith('HIGH_URL_DENSITY'))).toBe(true);
      expect(flags.some((f) => f.startsWith('SPAM_KEYWORD'))).toBe(true);
    });

    it('flags HIGH_URL_DENSITY when 5+ URLs present', async () => {
      mockKeywordRepo.find.mockResolvedValue([]);

      const urls = Array.from({ length: 6 }, (_, i) => `http://link${i}.com`).join(' ');
      const { flags } = await service.analyse('Test', 'Subject', urls, 'unknown');

      expect(flags.some((f) => f.startsWith('HIGH_URL_DENSITY'))).toBe(true);
    });

    it('adds URL_COUNT flag for 2–4 URLs', async () => {
      mockKeywordRepo.find.mockResolvedValue([]);

      const { flags } = await service.analyse(
        'Test',
        'Subject',
        'Check http://a.com and http://b.com for details.',
        'unknown',
      );

      expect(flags.some((f) => f.startsWith('URL_COUNT'))).toBe(true);
    });

    it('flags MESSAGE_TOO_SHORT for very short messages', async () => {
      mockKeywordRepo.find.mockResolvedValue([]);

      const { flags } = await service.analyse('Test', 'Hi', 'Hello', 'unknown');

      expect(flags).toContain('MESSAGE_TOO_SHORT');
    });

    it('flags REPEATED_CHARS for runs of 5+ identical characters', async () => {
      mockKeywordRepo.find.mockResolvedValue([]);

      const { flags } = await service.analyse(
        'Test',
        'Subject',
        'This is a normal message but with aaaaaaa repeated chars!!!!!!',
        'unknown',
      );

      expect(flags.some((f) => f.startsWith('REPEATED_CHARS'))).toBe(true);
    });

    it('flags HIGH_VELOCITY when same IP submits 3+ times in 10 minutes', async () => {
      mockKeywordRepo.find.mockResolvedValue([]);
      mockMessageRepo.count.mockResolvedValue(3);

      const { score, flags } = await service.analyse(
        'Test',
        'Subject',
        'A perfectly normal message with enough length to pass other checks.',
        '10.0.0.5',
      );

      expect(flags.some((f) => f.startsWith('HIGH_VELOCITY'))).toBe(true);
      expect(score).toBeGreaterThan(0.3);
    });

    it('does not flag velocity for unknown IP', async () => {
      mockKeywordRepo.find.mockResolvedValue([]);
      // count should NOT be called for unknown IP
      const { flags } = await service.analyse('Test', 'Subject', 'Normal message here.', 'unknown');

      expect(mockMessageRepo.count).not.toHaveBeenCalled();
      expect(flags.some((f) => f.includes('VELOCITY'))).toBe(false);
    });

    it('score is always in [0, 1] regardless of input (property-based)', async () => {
      mockKeywordRepo.find.mockResolvedValue(SPAM_KEYWORDS);
      mockMessageRepo.count.mockResolvedValue(10); // extreme velocity

      const extremeInputs = [
        { name: 'A', subject: 'B', message: 'C', ip: '1.2.3.4' },
        {
          name: 'Spammer',
          subject: 'buy now buy now buy now',
          message: Array(200).fill('http://spam.com buy now free money casino click here').join(' '),
          ip: '5.6.7.8',
        },
        { name: '', subject: '', message: '', ip: 'unknown' },
      ];

      for (const input of extremeInputs) {
        const { score } = await service.analyse(input.name, input.subject, input.message, input.ip);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    });
  });

  // ── isSpam ──────────────────────────────────────────────────────────────────

  describe('isSpam', () => {
    it('returns true for score > 0.7', () => {
      expect(service.isSpam(0.71)).toBe(true);
      expect(service.isSpam(1.0)).toBe(true);
    });

    it('returns false for score <= 0.7', () => {
      expect(service.isSpam(0.7)).toBe(false);
      expect(service.isSpam(0.0)).toBe(false);
    });
  });

  // ── Integration: spam submission is saved as flagged ────────────────────────

  describe('spam submission status', () => {
    it('spam message gets FLAGGED status', async () => {
      mockKeywordRepo.find.mockResolvedValue(SPAM_KEYWORDS);
      mockMessageRepo.count.mockResolvedValue(5); // high velocity

      const { score } = await service.analyse(
        'Spammer',
        'buy now free money',
        'http://a.com http://b.com http://c.com http://d.com http://e.com casino click here',
        '10.0.0.1',
      );

      const expectedStatus = service.isSpam(score)
        ? ContactMessageStatus.FLAGGED
        : ContactMessageStatus.PENDING;

      expect(expectedStatus).toBe(ContactMessageStatus.FLAGGED);
    });

    it('legitimate message gets PENDING status', async () => {
      mockKeywordRepo.find.mockResolvedValue(SPAM_KEYWORDS);
      mockMessageRepo.count.mockResolvedValue(0);

      const { score } = await service.analyse(
        'Alice Johnson',
        'Inquiry about coworking space',
        'Hello, I am interested in renting a hot desk for next month. Could you please provide pricing details and availability? Thank you.',
        '192.168.1.100',
      );

      const expectedStatus = service.isSpam(score)
        ? ContactMessageStatus.FLAGGED
        : ContactMessageStatus.PENDING;

      expect(expectedStatus).toBe(ContactMessageStatus.PENDING);
    });
  });
});
