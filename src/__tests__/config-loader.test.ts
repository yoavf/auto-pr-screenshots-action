import { promises as fs } from 'node:fs';
import {
  loadConfig,
  normalizeConfig,
  normalizeViewport,
  type RawConfig,
  validateConfig,
} from '../config-loader';

jest.mock('node:fs', () => ({
  promises: {
    readFile: jest.fn(),
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

describe('config-loader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadConfig', () => {
    it('should load and parse YAML config file', async () => {
      const mockYaml = `
version: 1
screenshots:
  - name: home
    url: http://localhost:3000
    viewport: desktop
  - name: about
    url: http://localhost:3000/about
    viewport: mobile
`;
      (fs.readFile as jest.Mock).mockResolvedValue(mockYaml);

      const config = await loadConfig('.github/screenshots.config.yml');

      expect(config.version).toBe(1);
      expect(config.screenshots).toHaveLength(2);
      expect(config.screenshots[0].name).toBe('home');
      expect(config.screenshots[0].viewport).toEqual({ width: 1440, height: 900 });
      expect(config.screenshots[1].viewport).toEqual({
        width: 390,
        height: 844,
        deviceScaleFactor: 3,
      });
    });

    it('should throw specific error when file not found', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(error);

      await expect(loadConfig('missing.yml')).rejects.toThrow('Config file not found: missing.yml');
    });

    it('should throw generic error for other failures', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      await expect(loadConfig('config.yml')).rejects.toThrow(
        'Failed to load config: Permission denied',
      );
    });
  });

  describe('validateConfig', () => {
    it('should validate correct config', () => {
      const config = {
        version: 1,
        screenshots: [{ name: 'test', url: 'http://localhost' }],
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should throw if config is not an object', () => {
      expect(() => validateConfig(null)).toThrow('Config must be an object');
      expect(() => validateConfig('string')).toThrow('Config must be an object');
      expect(() => validateConfig(123)).toThrow('Config must be an object');
    });

    it('should throw if no screenshots provided', () => {
      expect(() => validateConfig({ version: 1, screenshots: [] })).toThrow(
        'Config must include at least one screenshot',
      );
    });

    it('should throw if screenshot missing name', () => {
      const config = {
        screenshots: [{ url: 'http://localhost' }],
      };
      expect(() => validateConfig(config)).toThrow('Each screenshot must have a name');
    });

    it('should throw if screenshot missing url and path', () => {
      const config = {
        screenshots: [{ name: 'test' }],
      };
      expect(() => validateConfig(config)).toThrow(
        'Screenshot "test" must have either url or path',
      );
    });

    it('should accept path instead of url', () => {
      const config = {
        screenshots: [{ name: 'test', path: '/home' }],
      };
      expect(() => validateConfig(config)).not.toThrow();
    });
  });

  describe('normalizeViewport', () => {
    it('should return desktop dimensions by default', () => {
      expect(normalizeViewport()).toEqual({ width: 1440, height: 900 });
    });

    it('should handle viewport presets', () => {
      expect(normalizeViewport('desktop')).toEqual({ width: 1440, height: 900 });
      expect(normalizeViewport('laptop')).toEqual({ width: 1366, height: 768 });
      expect(normalizeViewport('tablet')).toEqual({ width: 768, height: 1024 });
      expect(normalizeViewport('mobile')).toEqual({
        width: 390,
        height: 844,
        deviceScaleFactor: 3,
      });
    });

    it('should handle custom viewport object', () => {
      const custom = { width: 1920, height: 1080, deviceScaleFactor: 2 };
      expect(normalizeViewport(custom)).toEqual(custom);
    });

    it('should throw for unknown preset', () => {
      expect(() => normalizeViewport('unknown')).toThrow('Unknown viewport preset: unknown');
    });
  });

  describe('normalizeConfig', () => {
    it('should normalize config with defaults', () => {
      const raw: RawConfig = {
        screenshots: [{ name: 'test', url: 'http://localhost' }],
      };

      const normalized = normalizeConfig(raw);

      expect(normalized.version).toBe(1);
      expect(normalized.output).toEqual({
        branch: 'gh-screenshots',
        comment: {
          template: 'default',
          group_by: 'viewport',
        },
      });
    });

    it('should convert path to localhost URL', () => {
      const raw: RawConfig = {
        screenshots: [{ name: 'test', path: '/about' }],
      };

      const normalized = normalizeConfig(raw);
      expect(normalized.screenshots[0].url).toBe('http://localhost:3000/about');
    });

    it('should handle wait_for alias', () => {
      const raw: RawConfig = {
        screenshots: [{ name: 'test', url: 'http://localhost', wait_for: '.loaded' }],
      };

      const normalized = normalizeConfig(raw);
      expect(normalized.screenshots[0].waitFor).toBe('.loaded');
    });

    it('should normalize skip configuration with defaults', () => {
      const raw: RawConfig = {
        screenshots: [{ name: 'test', url: 'http://localhost' }],
      };

      const normalized = normalizeConfig(raw);
      expect(normalized.skip).toEqual({
        wipTitles: true,
      });
    });

    it('should handle skip configuration from raw config', () => {
      const raw: RawConfig = {
        screenshots: [{ name: 'test', url: 'http://localhost' }],
        skip: {
          label: 'skip-screenshots',
          wipTitles: false,
        },
      };

      const normalized = normalizeConfig(raw);
      expect(normalized.skip).toEqual({
        label: 'skip-screenshots',
        wipTitles: false,
      });
    });
  });
});
