import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { ScaffoldrError } from '../errors/index.js';
import { diffAgainstDisk } from './diff.js';
import { VFS } from './vfs.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'scaffoldr-diff-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('diffAgainstDisk', () => {
  test('sorts files into added, modified and unchanged', async () => {
    await writeFile(path.join(root, 'same.txt'), 'same content\n');
    await writeFile(path.join(root, 'changed.txt'), 'old content\n');

    const vfs = new VFS();
    vfs.set('same.txt', 'same content\n', 'next-app');
    vfs.set('changed.txt', 'new content\n', 'next-app');
    vfs.set('missing.txt', 'brand new\n', 'next-app');

    const diff = await diffAgainstDisk(vfs, root);

    expect(diff).toEqual({
      added: ['missing.txt'],
      modified: ['changed.txt'],
      unchanged: ['same.txt'],
    });
  });

  test('compares nested files and binary content byte for byte', async () => {
    const bytes = new Uint8Array([0, 255, 128, 10, 13]);
    await mkdir(path.join(root, 'public'), { recursive: true });
    await writeFile(path.join(root, 'public', 'logo.bin'), bytes);
    await writeFile(
      path.join(root, 'public', 'other.bin'),
      new Uint8Array([1, 2, 3]),
    );

    const vfs = new VFS();
    vfs.set('public/logo.bin', bytes, 'ui-shadcn');
    vfs.set('public/other.bin', new Uint8Array([1, 2, 4]), 'ui-shadcn');
    vfs.set('public/deeper/new.bin', bytes, 'ui-shadcn');

    const diff = await diffAgainstDisk(vfs, root);

    expect(diff).toEqual({
      added: ['public/deeper/new.bin'],
      modified: ['public/other.bin'],
      unchanged: ['public/logo.bin'],
    });
  });

  test('treats a line-ending difference as modified', async () => {
    await writeFile(path.join(root, 'a.txt'), 'one\r\ntwo\r\n');

    const vfs = new VFS();
    vfs.set('a.txt', 'one\ntwo\n', 'next-app');

    expect((await diffAgainstDisk(vfs, root)).modified).toEqual(['a.txt']);
  });

  test('ignores files that exist only on disk', async () => {
    await writeFile(path.join(root, 'only-on-disk.txt'), 'x');

    const diff = await diffAgainstDisk(new VFS(), root);

    expect(diff).toEqual({ added: [], modified: [], unchanged: [] });
  });

  test('returns each list sorted', async () => {
    const vfs = new VFS();
    vfs.set('z.txt', 'z', 'owner');
    vfs.set('a.txt', 'a', 'owner');
    vfs.set('m.txt', 'm', 'owner');

    expect((await diffAgainstDisk(vfs, root)).added).toEqual([
      'a.txt',
      'm.txt',
      'z.txt',
    ]);
  });

  test('refuses a VFS path that would escape the root', async () => {
    const vfs = new VFS();
    vfs.set('../outside.txt', 'x', 'owner');

    const error = await diffAgainstDisk(vfs, root).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ScaffoldrError);
    expect((error as ScaffoldrError).code).toBe('UNSAFE_PATH');
  });
});
