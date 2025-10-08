import { promises as fs } from 'node:fs';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';
import { postComment } from './comment-poster';
import { loadConfig } from './config-loader';
import { detectFramework } from './framework-detector';
import { logger } from './logger';
import { captureScreenshots } from './screenshot-capture';
import { uploadScreenshots } from './screenshot-uploader';
import type { Config } from './types';

// Track if we need to exit
let _shouldExit = false;

// Handle process termination
process.on('SIGINT', () => {
  logger.info('\nReceived SIGINT, cleaning up...');
  _shouldExit = true;
  process.exit(130);
});

process.on('SIGTERM', () => {
  logger.info('\nReceived SIGTERM, cleaning up...');
  _shouldExit = true;
  process.exit(143);
});

export async function run(): Promise<void> {
  const startTime = Date.now();
  logger.info('🚀 Auto PR Screenshots starting...');

  try {
    // Get inputs
    const url = core.getInput('url');
    const configFile = core.getInput('config-file');
    const browsers = core.getInput('browsers');
    const skipComment = core.getInput('skip-comment') === 'true';
    const failOnError = core.getInput('fail-on-error') === 'true';
    const branch = core.getInput('branch');
    const token = core.getInput('github-token');
    const workingDirectory = core.getInput('working-directory');
    const showAttribution = core.getInput('show-attribution') === 'true';

    // Change to working directory if specified
    if (workingDirectory && workingDirectory !== '.') {
      process.chdir(workingDirectory);
      logger.info(`📁 Changed working directory to: ${workingDirectory}`);
    }

    // Log configuration
    logger.info('📋 Configuration:', {
      url,
      configFile,
      browsers,
      skipComment,
      branch,
      failOnError,
      workingDirectory,
    });

    // Load configuration with proper precedence
    const config = await loadConfiguration({
      url,
      configFile,
      branch,
      failOnError,
    });

    // Install Playwright browsers if needed
    if (!process.env.LOCAL_TEST && process.env.GITHUB_ACTIONS) {
      logger.info('🎭 Installing Playwright browsers...');
      try {
        const browsersToInstall = browsers || 'chromium';
        // Use npx with explicit version to ensure consistency
        // The -y flag auto-confirms installation
        await exec.exec('npx', [
          '-y',
          'playwright@1.56.0',
          'install',
          '--with-deps',
          ...browsersToInstall.split(',').map((b) => b.trim()),
        ]);
        logger.success('✅ Playwright browsers installed');
      } catch (error) {
        logger.error('Failed to install Playwright browsers:', error);
        throw new Error(
          'Failed to install Playwright browsers. This is required for screenshot capture.',
        );
      }
    }

    // Validate we're in a PR context
    const context = github.context;
    if (context.eventName !== 'pull_request' && !process.env.LOCAL_TEST) {
      logger.warn('⚠️  Not running in a pull request context, some features may be limited');
    }

    // Capture screenshots
    logger.info('📸 Capturing screenshots...');
    const captureResult = await captureScreenshots(config, { browsers });
    const screenshots = captureResult.successful;
    const screenshotErrors = captureResult.failed;

    if (screenshotErrors.length > 0) {
      logger.warn(`⚠️  ${screenshotErrors.length} screenshot(s) failed to capture`);
    }

    if (screenshots.length === 0) {
      const errorMessage = 'No screenshots were captured. Check your configuration and logs above.';
      logger.error(`❌ ${errorMessage}`);

      if (failOnError) {
        core.setFailed(errorMessage);
        process.exit(1);
      } else {
        logger.warn('⚠️  Continuing despite no screenshots (fail-on-error is false)');
        // Post comment with just errors if we're in a PR context
        if (!skipComment && context.eventName === 'pull_request') {
          logger.info('💬 Posting error comment to PR...');
          await postComment([], screenshotErrors, {
            token,
            context,
            config,
            showAttribution,
          });
          logger.success('✅ Error comment posted');
        }
        return; // Exit early but don't fail
      }
    }

    logger.success(`✅ Captured ${screenshots.length} screenshot(s)`);

    // Upload to branch
    logger.info(`📤 Uploading screenshots to branch: ${branch}`);
    const uploadedUrls = await uploadScreenshots(screenshots, {
      branch,
      token,
      context,
    });

    // Post comment to PR
    if (!skipComment && context.eventName === 'pull_request') {
      logger.info('💬 Posting comment to PR...');
      await postComment(uploadedUrls, screenshotErrors, {
        token,
        context,
        config,
        showAttribution,
      });
      logger.success('✅ Comment posted successfully');
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.success(`🎉 Auto PR Screenshots completed in ${duration}s`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('❌ Error:', errorMessage);

    if (error instanceof Error && error.stack && process.env.RUNNER_DEBUG === '1') {
      logger.debug('Stack trace:', error.stack);
    }

    // Provide helpful error messages
    if (errorMessage.includes('timeout') || errorMessage.includes('failed to load')) {
      logger.info('\n💡 Tip: Make sure your application is running and accessible');
      logger.info('   The URL should be reachable before running this action');
    }

    // Handle errors based on fail-on-error setting
    if (core.getInput('fail-on-error') === 'true') {
      core.setFailed(errorMessage);
      process.exit(1);
    } else {
      logger.warn('⚠️  Continuing despite error (fail-on-error is false)');
    }
  }
}

function createSimpleConfig(url: string): Config {
  return {
    version: 1,
    screenshots: [
      {
        name: 'desktop-home',
        url,
        viewport: {
          width: 1440,
          height: 900,
        },
      },
      {
        name: 'mobile-home',
        url,
        viewport: {
          width: 390,
          height: 844,
          deviceScaleFactor: 3,
        },
      },
    ],
    output: {
      branch: 'gh-screenshots',
      comment: {
        template: 'default',
        group_by: 'viewport',
      },
    },
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadConfiguration(options: {
  url?: string;
  configFile?: string;
  branch?: string;
  failOnError: boolean;
}): Promise<Config> {
  const { url, configFile, branch, failOnError } = options;

  // Step 1: Try to load config file
  const configPath = configFile || '.github/screenshots.config.yml';
  let baseConfig: Config | null = null;

  if (await fileExists(configPath)) {
    try {
      logger.info(`📄 Loading config from: ${configPath}`);
      baseConfig = await loadConfig(configPath);
    } catch (error) {
      logger.error(`Failed to load config file: ${error}`);
      if (failOnError) throw error;
    }
  }

  // Step 2: If no config file, try alternatives
  if (!baseConfig) {
    if (url) {
      logger.info(`🌐 Using provided URL: ${url}`);
      baseConfig = createSimpleConfig(url);
    } else {
      logger.info('🔍 Attempting framework detection...');
      const framework = await detectFramework();
      if (framework) {
        logger.success(`✅ Detected framework: ${framework.name}`);
        baseConfig = framework.config;
      }
    }
  }

  // Step 3: Validate we have a config
  if (!baseConfig) {
    throw new Error(
      'No configuration available.\n' +
        'Please either:\n' +
        '1. Provide a URL using the "url" input\n' +
        '2. Create a config file at .github/screenshots.config.yml\n' +
        '3. Ensure your project uses a supported framework for auto-detection',
    );
  }

  // Step 4: Apply overrides from action inputs
  const finalConfig = applyActionOverrides(baseConfig, { url, branch });

  return finalConfig;
}

function applyActionOverrides(
  config: Config,
  overrides: {
    url?: string;
    branch?: string;
  },
): Config {
  const result = { ...config };

  // Override URLs if provided
  if (overrides.url) {
    const overrideUrl = overrides.url;
    logger.info(`🔄 Overriding screenshot URLs with: ${overrideUrl}`);
    result.screenshots = result.screenshots.map((screenshot) => ({
      ...screenshot,
      url: overrideUrl,
    }));
  }

  // Override branch if provided
  if (overrides.branch) {
    result.output = {
      ...result.output,
      branch: overrides.branch,
    };
  }

  return result;
}

// Run the action
if (require.main === module) {
  run();
}
