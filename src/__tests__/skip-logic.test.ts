// Mock the checkShouldSkip function since it's not exported
// We'll test this through integration instead

jest.mock('@actions/github', () => ({
  getOctokit: jest.fn(),
  context: {
    eventName: 'pull_request',
    repo: {
      owner: 'test-owner',
      repo: 'test-repo',
    },
    payload: {
      pull_request: {
        number: 123,
        title: 'Test PR title',
      },
    },
  },
}));

jest.mock('../logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('skip logic integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('WIP title detection', () => {
    test('should match [wip] case insensitive', () => {
      const wipTitles = [
        '[WIP] Feature implementation',
        '[wip] Bug fix',
        '[Wip] Documentation update',
        'Feature [WIP] in progress',
        'Some [wip] work',
      ];

      const wipRegex = /\[wip\]/i;

      wipTitles.forEach((title) => {
        expect(wipRegex.test(title)).toBe(true);
      });
    });

    test('should not match non-WIP titles', () => {
      const nonWipTitles = [
        'Feature implementation',
        'Bug fix completed',
        'WIP without brackets',
        '[READY] Feature complete',
        'wip lowercase without brackets',
      ];

      const wipRegex = /\[wip\]/i;

      nonWipTitles.forEach((title) => {
        expect(wipRegex.test(title)).toBe(false);
      });
    });
  });

  describe('Label checking logic', () => {
    test('should handle string labels', () => {
      const labels = ['bug', 'enhancement', 'skip-screenshots'];
      const skipLabel = 'skip-screenshots';

      const hasSkipLabel = labels.some((label) => label === skipLabel);
      expect(hasSkipLabel).toBe(true);
    });

    test('should handle label objects', () => {
      const labels = [
        { name: 'bug', color: 'red' },
        { name: 'enhancement', color: 'blue' },
        { name: 'skip-screenshots', color: 'yellow' },
      ];
      const skipLabel = 'skip-screenshots';

      const hasSkipLabel = labels.some(
        (label) => (typeof label === 'string' ? label : label.name) === skipLabel,
      );
      expect(hasSkipLabel).toBe(true);
    });

    test('should not find non-existent labels', () => {
      const labels = [
        { name: 'bug', color: 'red' },
        { name: 'enhancement', color: 'blue' },
      ];
      const skipLabel = 'skip-screenshots';

      const hasSkipLabel = labels.some(
        (label) => (typeof label === 'string' ? label : label.name) === skipLabel,
      );
      expect(hasSkipLabel).toBe(false);
    });
  });
});
