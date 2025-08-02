import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { type Browser, chromium, firefox, type Page, webkit } from 'playwright';
import { captureLogger } from './logger';
import type { CapturedScreenshot, Config, ScreenshotConfig } from './types';

const BROWSER_MAP = {
  chromium,
  firefox,
  webkit,
} as const;

type BrowserName = keyof typeof BROWSER_MAP;

interface CaptureOptions {
  browsers?: string;
}

export async function captureScreenshots(
  config: Config,
  options: CaptureOptions = {},
): Promise<CapturedScreenshot[]> {
  const { browsers = 'chromium' } = options;
  const browserList = browsers.split(',').map((b) => b.trim()) as BrowserName[];

  captureLogger.info(`Starting screenshot capture with browsers: ${browserList.join(', ')}`);

  const screenshotsDir = path.join(process.cwd(), 'screenshots');
  await fs.mkdir(screenshotsDir, { recursive: true });

  const screenshots: CapturedScreenshot[] = [];

  for (const browserName of browserList) {
    if (!BROWSER_MAP[browserName]) {
      captureLogger.warn(`Unknown browser: ${browserName}, skipping`);
      continue;
    }

    const browser = await BROWSER_MAP[browserName].launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      for (const screenshotConfig of config.screenshots) {
        const screenshot = await captureScreenshot(browser, screenshotConfig, browserName);
        if (screenshot) {
          screenshots.push(screenshot);
        }
      }
    } finally {
      await browser.close();
    }
  }

  return screenshots;
}

async function captureScreenshot(
  browser: Browser,
  config: ScreenshotConfig,
  browserName: string,
): Promise<CapturedScreenshot | null> {
  const filename = `${config.name}-${browserName}.png`;
  const filepath = path.join(process.cwd(), 'screenshots', filename);

  try {
    captureLogger.info(`📸 Capturing ${config.name} (${browserName})...`);

    const context = await browser.newContext({
      viewport: config.viewport,
      deviceScaleFactor: config.viewport.deviceScaleFactor || 2,
    });

    const page = await context.newPage();

    // Navigate to the page
    await page.goto(config.url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');

    if (config.waitFor) {
      captureLogger.debug(`Waiting for selector: ${config.waitFor}`);
      try {
        await page.waitForSelector(config.waitFor, {
          state: 'visible',
          timeout: 10000,
        });
      } catch (_error) {
        captureLogger.warn(`Could not find selector "${config.waitFor}", continuing anyway`);
      }
    }

    if (config.wait) {
      captureLogger.debug(`Waiting for ${config.wait}ms`);
      await page.waitForTimeout(config.wait);
    }

    // Execute any configured steps
    if (config.steps && config.steps.length > 0) {
      captureLogger.debug(`Executing ${config.steps.length} step(s)`);
      await executeSteps(page, config.steps);
    }

    // Take screenshot
    await page.screenshot({
      path: filepath,
      fullPage: config.fullPage || false,
    });

    await context.close();

    captureLogger.success(`✅ Captured ${filename}`);
    return {
      name: config.name,
      browser: browserName,
      path: filepath,
    };
  } catch (error) {
    captureLogger.error(
      `Failed to capture ${config.name} (${browserName}):`,
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

async function executeSteps(page: Page, steps: ScreenshotConfig['steps']): Promise<void> {
  if (!steps) return;

  for (const step of steps) {
    if (step.click) {
      captureLogger.debug(`Clicking: ${step.click}`);
      await page.click(step.click);
    }

    if (step.fill) {
      captureLogger.debug(`Filling ${step.fill.selector} with text`);
      await page.fill(step.fill.selector, step.fill.text);
    }

    if (step.wait) {
      captureLogger.debug(`Waiting for ${step.wait}ms`);
      await page.waitForTimeout(step.wait);
    }

    if (step.waitFor) {
      captureLogger.debug(`Waiting for selector: ${step.waitFor}`);
      await page.waitForSelector(step.waitFor, { state: 'visible' });
    }
  }
}
