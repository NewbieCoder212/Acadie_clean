/**
 * Production-safe logger
 * Only logs in development mode, completely silent in production
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface LoggerOptions {
  prefix?: string;
  enabled?: boolean;
}

class Logger {
  private prefix: string;
  private enabled: boolean;

  constructor(options: LoggerOptions = {}) {
    this.prefix = options.prefix ? `[${options.prefix}]` : '';
    this.enabled = options.enabled ?? __DEV__;
  }

  private formatMessage(level: LogLevel, ...args: unknown[]): unknown[] {
    if (this.prefix) {
      return [this.prefix, ...args];
    }
    return args;
  }

  log(...args: unknown[]): void {
    if (this.enabled) {
      console.log(...this.formatMessage('log', ...args));
    }
  }

  info(...args: unknown[]): void {
    if (this.enabled) {
      console.info(...this.formatMessage('info', ...args));
    }
  }

  warn(...args: unknown[]): void {
    if (this.enabled) {
      console.warn(...this.formatMessage('warn', ...args));
    }
  }

  error(...args: unknown[]): void {
    // Always log errors, even in production
    console.error(...this.formatMessage('error', ...args));
  }

  debug(...args: unknown[]): void {
    if (this.enabled) {
      console.debug(...this.formatMessage('debug', ...args));
    }
  }
}

// Default logger instance
export const logger = new Logger();

// Create prefixed loggers for different modules
export function createLogger(prefix: string): Logger {
  return new Logger({ prefix });
}

// Pre-configured loggers for common modules
export const loggers = {
  email: createLogger('Email'),
  supabase: createLogger('Supabase'),
  offline: createLogger('Offline'),
  manager: createLogger('Manager'),
  admin: createLogger('Admin'),
  auth: createLogger('Auth'),
  api: createLogger('API'),
};

/**
 * Silent no-op functions for production
 * Use these to replace console.log calls that should never run in production
 */
export const noop = (): void => {};
export const noopLog = __DEV__ ? console.log.bind(console) : noop;
export const noopWarn = __DEV__ ? console.warn.bind(console) : noop;
export const noopInfo = __DEV__ ? console.info.bind(console) : noop;
