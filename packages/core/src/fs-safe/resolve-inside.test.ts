import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { ScaffoldrError } from '../errors/index.js';
import { resolveInside } from './resolve-inside.js';

const root = path.resolve('project-root');

function thrownBy(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('resolveInside', () => {
  test('resolves a plain relative path to an absolute path inside the root', () => {
    const result = resolveInside(root, 'a/b');

    expect(path.isAbsolute(result)).toBe(true);
    expect(result).toBe(path.join(root, 'a', 'b'));
  });

  test.each([
    ['a/../b', ['b']],
    ['./a/./b', ['a', 'b']],
    ['a//b', ['a', 'b']],
    ['.', []],
    ['', []],
    ['file..name', ['file..name']],
    ['a\\b', ['a', 'b']],
  ])('allows %j', (rel, expected) => {
    expect(resolveInside(root, rel)).toBe(path.join(root, ...expected));
  });

  test.each([
    ['../x'],
    ['..'],
    ['/etc/passwd'],
    ['a/../../x'],
    ['a/b/../../..'],
    ['..\\x'],
    ['a\\..\\..\\x'],
    ['\\Windows\\System32'],
    ['\\\\server\\share'],
    ['C:\\Windows'],
    ['C:/Windows'],
    ['C:relative'],
    ['../project-root-evil/x'],
    ['a\0b'],
  ])('rejects %j with UNSAFE_PATH', (rel) => {
    const error = thrownBy(() => resolveInside(root, rel));

    expect(error).toBeInstanceOf(ScaffoldrError);
    expect((error as ScaffoldrError).code).toBe('UNSAFE_PATH');
  });

  test('the error carries a hint and the offending path', () => {
    const error = thrownBy(() => resolveInside(root, '../x')) as ScaffoldrError;

    expect(error.hint).toBeTruthy();
    expect(error.details).toEqual({ root, path: '../x' });
  });

  test('accepts a relative root and returns an absolute path', () => {
    const result = resolveInside('some/dir', 'a');

    expect(path.isAbsolute(result)).toBe(true);
    expect(result).toBe(path.resolve('some/dir', 'a'));
  });
});