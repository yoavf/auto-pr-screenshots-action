import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { frameworkLogger as logger } from './logger';
import type { Config, FrameworkInfo, ScreenshotConfig, Viewport } from './types';

interface FrameworkConfigItem {
  name: string;
  defaultPort: number;
  screenshotDefaults: {
    routes: Array<{ path: string; name: string }>;
  };
  // Detection criteria
  dependencies?: string[];
  devDependencies?: string[];
  files?: string[];
}

const FRAMEWORK_CONFIGS: Record<string, FrameworkConfigItem> = {
  next: {
    name: 'Next.js',
    defaultPort: 3000,
    dependencies: ['next'],
    screenshotDefaults: {
      routes: [{ path: '/', name: 'Home' }],
    },
  },
  nuxt: {
    name: 'Nuxt',
    defaultPort: 3000,
    dependencies: ['nuxt'],
    screenshotDefaults: {
      routes: [{ path: '/', name: 'Home' }],
    },
  },
  vite: {
    name: 'Vite',
    defaultPort: 5173,
    devDependencies: ['vite'],
    files: ['vite.config.js', 'vite.config.ts'],
    screenshotDefaults: {
      routes: [{ path: '/', name: 'Home' }],
    },
  },
  'create-react-app': {
    name: 'Create React App',
    defaultPort: 3000,
    dependencies: ['react-scripts'],
    screenshotDefaults: {
      routes: [{ path: '/', name: 'Home' }],
    },
  },
  'vue-cli': {
    name: 'Vue CLI',
    defaultPort: 8080,
    devDependencies: ['@vue/cli-service'],
    screenshotDefaults: {
      routes: [{ path: '/', name: 'Home' }],
    },
  },
  angular: {
    name: 'Angular',
    defaultPort: 4200,
    dependencies: ['@angular/core'],
    files: ['angular.json'],
    screenshotDefaults: {
      routes: [{ path: '/', name: 'Home' }],
    },
  },
  'svelte-kit': {
    name: 'SvelteKit',
    defaultPort: 5173,
    dependencies: ['@sveltejs/kit'],
    screenshotDefaults: {
      routes: [{ path: '/', name: 'Home' }],
    },
  },
  gatsby: {
    name: 'Gatsby',
    defaultPort: 8000,
    dependencies: ['gatsby'],
    screenshotDefaults: {
      routes: [{ path: '/', name: 'Home' }],
    },
  },
};

export async function detectFramework(): Promise<FrameworkInfo | null> {
  try {
    const projectDir = process.cwd();
    logger.debug(`Detecting framework in: ${projectDir}`);

    // Read package.json
    interface PackageJson {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    }
    let packageJson: PackageJson = {};
    try {
      const packageJsonPath = path.join(projectDir, 'package.json');
      packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    } catch (_error) {
      logger.debug('No package.json found');
      return null;
    }

    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Check each framework
    for (const [frameworkId, config] of Object.entries(FRAMEWORK_CONFIGS)) {
      let detected = false;

      // Check dependencies
      if (config.dependencies) {
        detected = config.dependencies.some((dep) => dep in dependencies);
      }

      // Check devDependencies
      if (!detected && config.devDependencies) {
        detected = config.devDependencies.some((dep) => dep in dependencies);
      }

      // Check for specific files
      if (!detected && config.files) {
        for (const file of config.files) {
          try {
            await fs.access(path.join(projectDir, file));
            detected = true;
            break;
          } catch {
            // File doesn't exist
          }
        }
      }

      if (detected) {
        logger.debug(`Detected framework: ${frameworkId} (${config.name})`);

        const port = await detectPort(packageJson, config);

        const resultConfig: Config = {
          version: 1,
          screenshots: generateDefaultScreenshots(config, port),
          output: {
            branch: 'gh-screenshots',
            comment: {
              template: 'default',
              group_by: 'viewport',
            },
          },
        };

        return {
          id: frameworkId,
          name: config.name,
          config: resultConfig,
        };
      }
    }

    logger.debug('No framework detected');
    return null;
  } catch (error) {
    logger.error(
      'Framework detection failed:',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

interface PackageJsonWithScripts {
  scripts?: Record<string, string>;
}

async function detectPort(
  packageJson: PackageJsonWithScripts,
  frameworkConfig: FrameworkConfigItem,
): Promise<number> {
  const scripts = packageJson.scripts || {};

  // Check common script names
  const scriptNames = ['dev', 'start', 'serve', 'develop'];
  for (const scriptName of scriptNames) {
    const script = scripts[scriptName];
    if (script) {
      // Look for port in script
      const portMatch = script.match(/--port[= ](\d+)|PORT=(\d+)/);
      if (portMatch) {
        return Number.parseInt(portMatch[1] || portMatch[2], 10);
      }
    }
  }

  return frameworkConfig.defaultPort;
}

function generateDefaultScreenshots(config: FrameworkConfigItem, port: number): ScreenshotConfig[] {
  const viewports: Array<Viewport & { name: string }> = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 3 },
  ];

  const screenshots: ScreenshotConfig[] = [];

  for (const route of config.screenshotDefaults.routes) {
    for (const viewport of viewports) {
      screenshots.push({
        name: `${viewport.name}-${route.name.toLowerCase()}`,
        url: `http://localhost:${port}${route.path}`,
        viewport: {
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: viewport.deviceScaleFactor,
        },
        // No waitFor selector by default - rely on Playwright's page load detection
      });
    }
  }

  return screenshots;
}

export { FRAMEWORK_CONFIGS };
