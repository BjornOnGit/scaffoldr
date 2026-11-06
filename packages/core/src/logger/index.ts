/// <reference types="node" />

export type LogMode = 'human' | 'json';
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/** Extra structured context. Only JSON mode prints it. */
export type LogFields = Record<string, unknown>;

export interface LoggerOptions {
  mode: LogMode;
  /** Show `debug` messages. Off by default. */
  verbose?: boolean;
  /** Where normal output goes. Defaults to `process.stdout`. */
  stdout?: (text: string) => void;
  /** Where human-mode warnings, errors and debug output go. Defaults to `process.stderr`. */
  stderr?: (text: string) => void;
}

export interface Logger {
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  debug(message: string, fields?: LogFields): void;
}

const humanPrefix: Record<LogLevel, string> = {
  info: '',
  warn: 'warn: ',
  error: 'error: ',
  debug: 'debug: ',
};

/**
 * Human mode prints plain lines: `info` to stdout, everything else to stderr.
 * JSON mode prints one JSON object per line, all of it to stdout.
 */
export function createLogger(options: LoggerOptions): Logger {
  const { mode, verbose = false } = options;
  const writeOut = options.stdout ?? ((text: string) => void process.stdout.write(text));
  const writeErr = options.stderr ?? ((text: string) => void process.stderr.write(text));

  function log(level: LogLevel, message: string, fields: LogFields = {}): void {
    if (level === 'debug' && !verbose) {
      return;
    }
    if (mode === 'json') {
      writeOut(`${JSON.stringify({ ...fields, level, message })}\n`);
      return;
    }
    const write = level === 'info' ? writeOut : writeErr;
    write(`${humanPrefix[level]}${message}\n`);
  }

  return {
    info: (message, fields) => log('info', message, fields),
    warn: (message, fields) => log('warn', message, fields),
    error: (message, fields) => log('error', message, fields),
    debug: (message, fields) => log('debug', message, fields),
  };
}