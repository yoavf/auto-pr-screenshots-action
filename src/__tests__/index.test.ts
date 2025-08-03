import * as core from '@actions/core';
import * as exec from '@actions/exec';

// Import the function we want to test - we need to access the isPlaywrightAvailable function
// Since it's not exported, we'll test the integration through the main behavior

jest.mock('@actions/core');
jest.mock('@actions/exec');
jest.mock('@actions/github');
jest.mock('../logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock other dependencies
jest.mock('../config-loader', () => ({
  loadConfig: jest.fn(),
}));

jest.mock('../framework-detector', () => ({
  detectFramework: jest.fn(),
}));

jest.mock('../screenshot-capture', () => ({
  captureScreenshots: jest.fn(),
}));

jest.mock('../screenshot-uploader', () => ({
  uploadScreenshots: jest.fn(),
}));

jest.mock('../comment-poster', () => ({
  postComment: jest.fn(),
}));

describe('Playwright Installation Logic', () => {
  const mockExec = exec.exec as jest.MockedFunction<typeof exec.exec>;
  const mockGetInput = core.getInput as jest.MockedFunction<typeof core.getInput>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Set default environment
    process.env.GITHUB_ACTIONS = 'true';
    delete process.env.LOCAL_TEST;

    // Mock default inputs
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        url: 'http://localhost:3000',
        'config-file': '',
        browsers: 'chromium',
        'skip-comment': 'false',
        'fail-on-error': 'true',
        branch: 'gh-screenshots',
        'github-token': 'fake-token',
        'working-directory': '.',
        'show-attribution': 'false',
        'skip-playwright-install': 'false',
      };
      return inputs[name] || '';
    });
  });

  afterEach(() => {
    delete process.env.GITHUB_ACTIONS;
    delete process.env.LOCAL_TEST;
  });

  describe('isPlaywrightAvailable helper function behavior', () => {
    it('should skip installation when playwright is available', async () => {
      // Mock playwright being available
      mockExec
        .mockResolvedValueOnce(0) // playwright --version succeeds
        .mockImplementationOnce(async (_command, _args, options) => {
          // playwright list command - simulate browsers being available
          if (options?.listeners?.stdout) {
            options.listeners.stdout(Buffer.from('chromium available\nfirefox available\n'));
          }
          return 0;
        });

      // Import and run the function - we need to dynamically import to ensure mocks are set up
      const { run } = await import('../index');

      // Mock successful config loading and screenshot capture
      const { loadConfig } = await import('../config-loader');
      const { captureScreenshots } = await import('../screenshot-capture');
      const { uploadScreenshots } = await import('../screenshot-uploader');

      (loadConfig as jest.Mock).mockResolvedValue({
        screenshots: [
          { name: 'test', url: 'http://localhost:3000', viewport: { width: 1440, height: 900 } },
        ],
        output: { branch: 'gh-screenshots' },
      });
      (captureScreenshots as jest.Mock).mockResolvedValue([
        { name: 'test', browser: 'chromium', path: '/tmp/test.png' },
      ]);
      (uploadScreenshots as jest.Mock).mockResolvedValue(['http://example.com/test.png']);

      await run();

      // Verify that playwright installation was not attempted
      expect(mockExec).not.toHaveBeenCalledWith('npm', ['install', '-g', 'playwright']);
      expect(mockExec).not.toHaveBeenCalledWith(
        'playwright',
        expect.arrayContaining(['install', '--with-deps']),
      );

      // But playwright --version and list should have been called for checking
      expect(mockExec).toHaveBeenCalledWith('playwright', ['--version'], expect.any(Object));
      expect(mockExec).toHaveBeenCalledWith('playwright', ['list'], expect.any(Object));
    });

    it('should install playwright when not available', async () => {
      // Mock playwright not being available
      mockExec
        .mockRejectedValueOnce(new Error('command not found')) // playwright --version fails
        .mockResolvedValueOnce(0) // npm install succeeds
        .mockResolvedValueOnce(0); // playwright install succeeds

      const { run } = await import('../index');

      // Mock successful config loading and screenshot capture
      const { loadConfig } = await import('../config-loader');
      const { captureScreenshots } = await import('../screenshot-capture');
      const { uploadScreenshots } = await import('../screenshot-uploader');

      (loadConfig as jest.Mock).mockResolvedValue({
        screenshots: [
          { name: 'test', url: 'http://localhost:3000', viewport: { width: 1440, height: 900 } },
        ],
        output: { branch: 'gh-screenshots' },
      });
      (captureScreenshots as jest.Mock).mockResolvedValue([
        { name: 'test', browser: 'chromium', path: '/tmp/test.png' },
      ]);
      (uploadScreenshots as jest.Mock).mockResolvedValue(['http://example.com/test.png']);

      await run();

      // Verify that playwright installation was attempted
      expect(mockExec).toHaveBeenCalledWith('npm', ['install', '-g', 'playwright']);
      expect(mockExec).toHaveBeenCalledWith('playwright', ['install', '--with-deps', 'chromium']);
    });

    it('should skip installation when skip-playwright-install is true', async () => {
      // Set skip-playwright-install to true
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          url: 'http://localhost:3000',
          'config-file': '',
          browsers: 'chromium',
          'skip-comment': 'false',
          'fail-on-error': 'true',
          branch: 'gh-screenshots',
          'github-token': 'fake-token',
          'working-directory': '.',
          'show-attribution': 'false',
          'skip-playwright-install': 'true', // This is the key change
        };
        return inputs[name] || '';
      });

      const { run } = await import('../index');

      // Mock successful config loading and screenshot capture
      const { loadConfig } = await import('../config-loader');
      const { captureScreenshots } = await import('../screenshot-capture');
      const { uploadScreenshots } = await import('../screenshot-uploader');

      (loadConfig as jest.Mock).mockResolvedValue({
        screenshots: [
          { name: 'test', url: 'http://localhost:3000', viewport: { width: 1440, height: 900 } },
        ],
        output: { branch: 'gh-screenshots' },
      });
      (captureScreenshots as jest.Mock).mockResolvedValue([
        { name: 'test', browser: 'chromium', path: '/tmp/test.png' },
      ]);
      (uploadScreenshots as jest.Mock).mockResolvedValue(['http://example.com/test.png']);

      await run();

      // Verify that no playwright installation or checking was attempted
      expect(mockExec).not.toHaveBeenCalledWith('playwright', ['--version'], expect.any(Object));
      expect(mockExec).not.toHaveBeenCalledWith('playwright', ['list'], expect.any(Object));
      expect(mockExec).not.toHaveBeenCalledWith('npm', ['install', '-g', 'playwright']);
      expect(mockExec).not.toHaveBeenCalledWith(
        'playwright',
        expect.arrayContaining(['install', '--with-deps']),
      );
    });

    it('should skip installation in local test environment', async () => {
      // Set LOCAL_TEST environment
      process.env.LOCAL_TEST = 'true';

      const { run } = await import('../index');

      // Mock successful config loading and screenshot capture
      const { loadConfig } = await import('../config-loader');
      const { captureScreenshots } = await import('../screenshot-capture');
      const { uploadScreenshots } = await import('../screenshot-uploader');

      (loadConfig as jest.Mock).mockResolvedValue({
        screenshots: [
          { name: 'test', url: 'http://localhost:3000', viewport: { width: 1440, height: 900 } },
        ],
        output: { branch: 'gh-screenshots' },
      });
      (captureScreenshots as jest.Mock).mockResolvedValue([
        { name: 'test', browser: 'chromium', path: '/tmp/test.png' },
      ]);
      (uploadScreenshots as jest.Mock).mockResolvedValue(['http://example.com/test.png']);

      await run();

      // Verify that no playwright installation was attempted
      expect(mockExec).not.toHaveBeenCalledWith('npm', ['install', '-g', 'playwright']);
      expect(mockExec).not.toHaveBeenCalledWith(
        'playwright',
        expect.arrayContaining(['install', '--with-deps']),
      );
    });
  });
});
