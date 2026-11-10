import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { ScaffoldrError } from '../errors/index.js';
import { assertTargetWritable } from './target.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'scaffoldr-target-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function errorFrom(dir: string): Promise<ScaffoldrError> {
  const error = await assertTargetWritable(dir).then(
    () => undefined,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ScaffoldrError);
  return error as ScaffoldrError;
}

describe('assertTargetWritable', () => {
  test('passes when the directory does not exist', async () => {
    await expect(
      assertTargetWritable(path.join(root, 'my-app')),
    ).resolves.toBeUndefined();
  });

  test('passes when the directory exists and is empty', async () => {
    const dir = path.join(root, 'empty');
    await mkdir(dir);

    await expect(assertTargetWritable(dir)).resolves.toBeUndefined();
  });

  test('throws TARGET_NOT_EMPTY when the directory has a file', async () => {
    const dir = path.join(root, 'full');
    await mkdir(dir);
    await writeFile(path.join(dir, 'package.json'), '{}');

    const error = await errorFrom(dir);

    expect(error.code).toBe('TARGET_NOT_EMPTY');
    expect(error.hint).toBeTruthy();
    expect(error.details).toEqual({ dir, existing: ['package.json'] });
  });

  test('counts hidden files such as .git as content', async () => {
    const dir = path.join(root, 'repo');
    await mkdir(path.join(dir, '.git'), { recursive: true });

    expect((await errorFrom(dir)).code).toBe('TARGET_NOT_EMPTY');
  });

  test('counts an empty subfolder as content', async () => {
    const dir = path.join(root, 'nested');
    await mkdir(path.join(dir, 'src'), { recursive: true });

    expect((await errorFrom(dir)).code).toBe('TARGET_NOT_EMPTY');
  });

  test('throws TARGET_NOT_EMPTY when the path is a file', async () => {
    const file = path.join(root, 'a-file');
    await writeFile(file, 'x');

    expect((await errorFrom(file)).code).toBe('TARGET_NOT_EMPTY');
  });

  test('lists at most five names, sorted, in the error details', async () => {
    const dir = path.join(root, 'many');
    await mkdir(dir);
    for (const name of ['g', 'f', 'e', 'd', 'c', 'b', 'a']) {
      await writeFile(path.join(dir, name), '');
    }

    expect((await errorFrom(dir)).details).toEqual({
      dir,
      existing: ['a', 'b', 'c', 'd', 'e'],
    });
  });

  test('does not change the directory', async () => {
    const dir = path.join(root, 'untouched');
    await mkdir(dir);
    await assertTargetWritable(dir);

    await expect(assertTargetWritable(dir)).resolves.toBeUndefined();
  });
});
