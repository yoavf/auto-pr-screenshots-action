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
import type { CapturedScreenshot, Config } from './types';

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

    let config: Config;

    // If URL is provided, create a simple config
    if (url) {
      logger.info(`🌐 Using provided URL: ${url}`);
      config = createSimpleConfig(url);
    }
    // Otherwise, try loading config file
    else if (configFile && (await fileExists(configFile))) {
      logger.info(`📄 Loading config from: ${configFile}`);
      config = await loadConfig(configFile);
    }
    // As a fallback, try to detect framework
    else {
      logger.info('🔍 No URL or config file provided, attempting framework detection...');
      const framework = await detectFramework();
      if (framework) {
        logger.success(`✅ Detected framework: ${framework.name}`);
        config = framework.config;
      } else {
        throw new Error(
          'No URL provided and could not detect framework automatically.\n' +
            'Please either:\n' +
            '1. Provide a URL using the "url" input\n' +
            '2. Create a config file at .github/screenshots.config.yml\n' +
            '3. Ensure your project uses a supported framework for auto-detection',
        );
      }
    }

    // Install Playwright browsers if needed
    if (!process.env.LOCAL_TEST && process.env.GITHUB_ACTIONS) {
      logger.info('🎭 Installing Playwright browsers...');
      try {
        const browsersToInstall = browsers || 'chromium';
        // First, install playwright globally to ensure CLI is available
        await exec.exec('npm', ['install', '-g', 'playwright']);

        // Then install the browsers
        await exec.exec('playwright', [
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
    let screenshots: CapturedScreenshot[] = [];
    screenshots = await captureScreenshots(config, { browsers });

    if (screenshots.length === 0) {
      const errorMessage = 'No screenshots were captured. Check your configuration and logs above.';
      logger.error(`❌ ${errorMessage}`);
      
      if (failOnError) {
        core.setFailed(errorMessage);
        process.exit(1);
      } else {
        logger.warn('⚠️  Continuing despite no screenshots (fail-on-error is false)');
        return; // Exit early but don't fail
      }
    }

    logger.success(`✅ Captured ${screenshots.length} screenshots`);

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
      await postComment(uploadedUrls, {
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

// Run the action
if (require.main === module) {
  run();
}
