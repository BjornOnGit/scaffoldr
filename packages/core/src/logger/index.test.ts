import { afterEach, describe, expect, test, vi } from 'vitest';
import { createLogger } from './index.js';
import type { LoggerOptions } from './index.js';

function capture(options: Pick<LoggerOptions, 'mode' | 'verbose'>) {
  const out: string[] = [];
  const err: string[] = [];
  const logger = createLogger({
    ...options,
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
  });
  return { logger, out, err };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('human mode', () => {
  test('prints info to stdout as a plain line', () => {
    const { logger, out, err } = capture({ mode: 'human' });
    logger.info('Generating project');

    expect(out).toEqual(['Generating project\n']);
    expect(err).toEqual([]);
  });

  test('prints warn and error to stderr with a prefix', () => {
    const { logger, out, err } = capture({ mode: 'human' });
    logger.warn('Folder already exists');
    logger.error('Could not write file');

    expect(out).toEqual([]);
    expect(err).toEqual(['warn: Folder already exists\n', 'error: Could not write file\n']);
  });

  test('ignores structured fields', () => {
    const { logger, out } = capture({ mode: 'human' });
    logger.info('Installed', { moduleId: 'db-prisma' });

    expect(out).toEqual(['Installed\n']);
  });
});

describe('json mode', () => {
  test('writes one JSON object per line to stdout for every level', () => {
    const { logger, out, err } = capture({ mode: 'json', verbose: true });
    logger.info('a');
    logger.warn('b');
    logger.error('c');
    logger.debug('d');

    expect(err).toEqual([]);
    expect(out).toHaveLength(4);
    for (const line of out) {
      expect(line.endsWith('\n')).toBe(true);
      expect(line.slice(0, -1)).not.toContain('\n');
    }
    expect(out.map((line) => JSON.parse(line))).toEqual([
      { level: 'info', message: 'a' },
      { level: 'warn', message: 'b' },
      { level: 'error', message: 'c' },
      { level: 'debug', message: 'd' },
    ]);
  });

  test('includes structured fields but never lets them override level or message', () => {
    const { logger, out } = capture({ mode: 'json' });
    logger.info('Installed', { moduleId: 'db-prisma', level: 'fake', message: 'fake' });

    expect(JSON.parse(out[0] ?? '')).toEqual({
      moduleId: 'db-prisma',
      level: 'info',
      message: 'Installed',
    });
  });
});

describe('debug', () => {
  test.each(['human', 'json'] as const)('is silent in %s mode unless verbose', (mode) => {
    const { logger, out, err } = capture({ mode });
    logger.debug('hidden');

    expect(out).toEqual([]);
    expect(err).toEqual([]);
  });

  test('prints to stderr in human mode when verbose', () => {
    const { logger, out, err } = capture({ mode: 'human', verbose: true });
    logger.debug('details');

    expect(out).toEqual([]);
    expect(err).toEqual(['debug: details\n']);
  });

  test('prints in json mode when verbose', () => {
    const { logger, out } = capture({ mode: 'json', verbose: true });
    logger.debug('details');

    expect(JSON.parse(out[0] ?? '')).toEqual({ level: 'debug', message: 'details' });
  });
});

describe('default output', () => {
  test('writes to process.stdout and process.stderr', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = createLogger({ mode: 'human' });

    logger.info('to stdout');
    logger.error('to stderr');

    expect(stdout).toHaveBeenCalledWith('to stdout\n');
    expect(stderr).toHaveBeenCalledWith('error: to stderr\n');
  });
});