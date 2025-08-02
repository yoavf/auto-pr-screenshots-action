import * as core from '@actions/core';
import debug from 'debug';

const loggers = {
  main: debug('screenshots:main'),
  framework: debug('screenshots:framework'),
  capture: debug('screenshots:capture'),
  upload: debug('screenshots:upload'),
  comment: debug('screenshots:comment'),
} as const;

if (process.env.RUNNER_DEBUG === '1') {
  debug.enable('screenshots:*');
}

type LoggerNamespace = keyof typeof loggers;

class Logger {
  private debugLogger: debug.Debugger;
  private isCI: boolean;

  constructor(namespace: LoggerNamespace = 'main') {
    this.debugLogger = loggers[namespace];
    this.isCI = process.env.CI === 'true';
  }

  info(message: string, ...args: unknown[]): void {
    const formatted = this._format(message, args);
    if (this.isCI) {
      core.info(formatted);
    } else {
      console.log(formatted);
    }
  }

  success(message: string, ...args: unknown[]): void {
    const formatted = this._format(message, args);
    if (this.isCI) {
      core.info(formatted);
    } else {
      console.log(`\x1b[32m${formatted}\x1b[0m`);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    const formatted = this._format(message, args);
    if (this.isCI) {
      core.warning(formatted);
    } else {
      console.warn(`\x1b[33m${formatted}\x1b[0m`);
    }
  }

  error(message: string, ...args: unknown[]): void {
    const formatted = this._format(message, args);
    if (this.isCI) {
      core.error(formatted);
    } else {
      console.error(`\x1b[31m${formatted}\x1b[0m`);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this.debugLogger(message, ...args);
  }

  async groupWithFunction<T>(title: string, fn: () => T | Promise<T>): Promise<T> {
    if (this.isCI) {
      // @actions/core.group handles both sync and async functions
      return await core.group(title, async () => fn());
    }
    console.log(`\n▶ ${title}`);
    const result = await fn();
    console.log('');
    return result;
  }

  group(title: string): void {
    if (this.isCI) {
      core.startGroup(title);
    } else {
      console.log(`\n▶ ${title}`);
    }
  }

  groupEnd(): void {
    if (this.isCI) {
      core.endGroup();
    } else {
      console.log('');
    }
  }

  private _format(message: string, args: unknown[]): string {
    if (args.length === 0) return message;

    if (args.length === 1 && typeof args[0] === 'object') {
      return `${message}\n${JSON.stringify(args[0], null, 2)}`;
    }

    return [message, ...args].join(' ');
  }
}

export const logger = new Logger('main');
export const frameworkLogger = new Logger('framework');
export const captureLogger = new Logger('capture');
export const uploadLogger = new Logger('upload');
export const commentLogger = new Logger('comment');
