import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'yaml';
import { logger } from './logger';
import type { Config, ScreenshotConfig, ScreenshotStep, Viewport } from './types';

const DEFAULT_CONFIG: Config = {
  version: 1,
  screenshots: [],
  output: {
    branch: 'gh-screenshots',
    comment: {
      template: 'default',
      group_by: 'viewport',
    },
  },
  skip: {
    wipTitles: true,
  },
};

export async function loadConfig(configPath: string): Promise<Config> {
  try {
    const absolutePath = path.resolve(process.cwd(), configPath);
    logger.debug(`Loading config from: ${absolutePath}`);

    const content = await fs.readFile(absolutePath, 'utf-8');
    const config = yaml.parse(content);

    const validated = validateConfig(config);
    const normalized = normalizeConfig(validated);

    logger.debug('Loaded config:', normalized);
    return normalized;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`Config file not found: ${configPath}`);
    }
    throw new Error(
      `Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function validateConfig(config: unknown): RawConfig {
  if (!config || typeof config !== 'object' || config === null) {
    throw new Error('Config must be an object');
  }

  const rawConfig = config as Record<string, unknown>;

  // Version is optional, default to 1
  if (rawConfig.version && rawConfig.version !== 1) {
    throw new Error(`Unsupported config version: ${rawConfig.version}. Expected: 1`);
  }

  if (!Array.isArray(rawConfig.screenshots) || rawConfig.screenshots.length === 0) {
    throw new Error('Config must include at least one screenshot');
  }

  for (const screenshot of rawConfig.screenshots) {
    if (!screenshot || typeof screenshot !== 'object') {
      throw new Error('Each screenshot must be an object');
    }
    const screenshotObj = screenshot as Record<string, unknown>;
    if (!screenshotObj.name) {
      throw new Error('Each screenshot must have a name');
    }
    if (!screenshotObj.url && !screenshotObj.path) {
      throw new Error(`Screenshot "${screenshotObj.name}" must have either url or path`);
    }
  }

  return rawConfig as RawConfig;
}

export interface RawConfig {
  version?: number;
  screenshots: Array<{
    name: string;
    url?: string;
    path?: string;
    viewport?: string | Viewport;
    fullPage?: boolean;
    waitFor?: string;
    wait_for?: string;
    wait?: number;
    steps?: Array<unknown>;
  }>;
  output?: {
    branch: string;
    comment: {
      template: string;
      group_by: string;
    };
  };
  skip?: {
    label?: string;
    wipTitles?: boolean;
    wip_titles?: boolean; // Support snake_case alias
  };
  [key: string]: unknown;
}

export function normalizeConfig(config: RawConfig): Config {
  const normalized: Config = {
    ...DEFAULT_CONFIG,
    version: config.version || 1,
    screenshots: [],
    output: config.output || DEFAULT_CONFIG.output,
    skip: {
      ...DEFAULT_CONFIG.skip,
      ...(config.skip && {
        label: config.skip.label,
        wipTitles:
          config.skip.wipTitles ?? config.skip.wip_titles ?? DEFAULT_CONFIG.skip!.wipTitles,
      }),
    },
  };

  normalized.screenshots = config.screenshots.map((screenshot) => {
    const base: ScreenshotConfig = {
      name: screenshot.name,
      url: screenshot.url || `http://localhost:3000${screenshot.path || '/'}`,
      viewport: normalizeViewport(screenshot.viewport),
      fullPage: screenshot.fullPage || false,
      waitFor: screenshot.waitFor || screenshot.wait_for,
      steps: (screenshot.steps || []) as ScreenshotStep[],
    };

    if (screenshot.wait) {
      base.wait = screenshot.wait;
    }

    return base;
  });

  return normalized;
}

export function normalizeViewport(viewport?: string | Viewport): Viewport {
  if (!viewport) {
    return { width: 1440, height: 900 };
  }

  if (typeof viewport === 'string') {
    switch (viewport.toLowerCase()) {
      case 'desktop':
        return { width: 1440, height: 900 };
      case 'laptop':
        return { width: 1366, height: 768 };
      case 'tablet':
        return { width: 768, height: 1024 };
      case 'mobile':
        return { width: 390, height: 844, deviceScaleFactor: 3 };
      default:
        throw new Error(
          `Unknown viewport preset: ${viewport}. Use desktop, laptop, tablet, mobile, or specify custom dimensions.`,
        );
    }
  }

  return {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
  };
}
