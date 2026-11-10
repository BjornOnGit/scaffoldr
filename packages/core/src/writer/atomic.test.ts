import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { ScaffoldrError } from '../errors/index.js';
import { VFS } from '../vfs/vfs.js';
import { writeAtomic } from './atomic.js';

let parent: string;

beforeEach(async () => {
  parent = await mkdtemp(path.join(tmpdir(), 'scaffoldr-atomic-'));
});

afterEach(async () => {
  await rm(parent, { recursive: true, force: true });
});

function sampleVfs(): VFS {
  const vfs = new VFS();
  vfs.set('package.json', '{ "name": "demo" }\n', 'next-app');
  vfs.set('src/app.ts', 'export {};\n', 'next-app');
  vfs.set(
    'public/logo.bin',
    new Uint8Array([137, 80, 78, 71, 0, 255]),
    'ui-shadcn',
  );
  return vfs;
}

describe('writeAtomic', () => {
  test('after success the target has the files and no temp dir remains', async () => {
    const target = path.join(parent, 'my-app');

    await writeAtomic(sampleVfs(), target);

    expect(await readFile(path.join(target, 'package.json'), 'utf8')).toBe(
      '{ "name": "demo" }\n',
    );
    expect(await readFile(path.join(target, 'src', 'app.ts'), 'utf8')).toBe(
      'export {};\n',
    );
    expect(
      new Uint8Array(await readFile(path.join(target, 'public', 'logo.bin'))),
    ).toEqual(new Uint8Array([137, 80, 78, 71, 0, 255]));
    expect(await readdir(parent)).toEqual(['my-app']);
  });

  test('works when the target is an existing empty folder', async () => {
    const target = path.join(parent, 'empty-target');
    await mkdir(target);

    await writeAtomic(sampleVfs(), target);

    expect(await readFile(path.join(target, 'src', 'app.ts'), 'utf8')).toBe(
      'export {};\n',
    );
    expect(await readdir(parent)).toEqual(['empty-target']);
  });

  test('creates missing parent folders', async () => {
    const target = path.join(parent, 'a', 'b', 'my-app');

    await writeAtomic(sampleVfs(), target);

    expect((await stat(path.join(target, 'package.json'))).isFile()).toBe(true);
    expect(await readdir(path.join(parent, 'a', 'b'))).toEqual(['my-app']);
  });

  test('produces an empty target for an empty VFS', async () => {
    const target = path.join(parent, 'blank');

    await writeAtomic(new VFS(), target);

    expect(await readdir(target)).toEqual([]);
    expect(await readdir(parent)).toEqual(['blank']);
  });

  test('refuses a non-empty target, leaves it untouched and creates no temp dir', async () => {
    const target = path.join(parent, 'busy');
    await mkdir(target);
    await writeFile(path.join(target, 'keep.txt'), 'keep me');

    const error = await writeAtomic(sampleVfs(), target).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ScaffoldrError);
    expect((error as ScaffoldrError).code).toBe('TARGET_NOT_EMPTY');
    expect(await readFile(path.join(target, 'keep.txt'), 'utf8')).toBe(
      'keep me',
    );
    expect(await readdir(target)).toEqual(['keep.txt']);
    expect(await readdir(parent)).toEqual(['busy']);
  });

  test('does not create the target when a VFS path is unsafe', async () => {
    const target = path.join(parent, 'never');
    const vfs = sampleVfs();
    vfs.set('../escape.txt', 'bad', 'owner');

    const error = await writeAtomic(vfs, target).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ScaffoldrError);
    expect((error as ScaffoldrError).code).toBe('UNSAFE_PATH');
    await expect(stat(target)).rejects.toThrow();
    await expect(stat(path.join(parent, 'escape.txt'))).rejects.toThrow();
    expect(await readdir(parent)).toEqual([]);
  });
});

describe('writeAtomic cleanup on failure', () => {
  test('with a failing writer the target is not created and the temp dir is removed', async () => {
    const target = path.join(parent, 'my-app');
    let tempDirSeen = '';
    const failingWrite = async (_vfs: VFS, dir: string): Promise<void> => {
      tempDirSeen = dir;
      await writeFile(path.join(dir, 'half-written.txt'), 'partial');
      throw new Error('disk full');
    };

    const error = await writeAtomic(sampleVfs(), target, {
      write: failingWrite,
    }).catch((caught: unknown) => caught);

    expect((error as Error).message).toBe('disk full');
    expect(path.dirname(tempDirSeen)).toBe(parent);
    expect(tempDirSeen).not.toBe(target);
    await expect(stat(target)).rejects.toThrow();
    await expect(stat(tempDirSeen)).rejects.toThrow();
    expect(await readdir(parent)).toEqual([]);
  });

  test('re-throws the very same error object', async () => {
    const boom = new Error('boom');
    const failingWrite = async (): Promise<void> => {
      throw boom;
    };

    const error = await writeAtomic(sampleVfs(), path.join(parent, 'x'), {
      write: failingWrite,
    }).catch((caught: unknown) => caught);

    expect(error).toBe(boom);
  });

  test('removes a temp dir that contains nested folders', async () => {
    const failingWrite = async (_vfs: VFS, dir: string): Promise<void> => {
      await mkdir(path.join(dir, 'a', 'b'), { recursive: true });
      await writeFile(path.join(dir, 'a', 'b', 'c.txt'), 'x');
      throw new Error('late failure');
    };

    await writeAtomic(sampleVfs(), path.join(parent, 'deep'), {
      write: failingWrite,
    }).catch(() => undefined);

    expect(await readdir(parent)).toEqual([]);
  });

  test('leaves an existing empty target folder in place when writing fails', async () => {
    const target = path.join(parent, 'empty-target');
    await mkdir(target);
    const failingWrite = async (): Promise<void> => {
      throw new Error('nope');
    };

    await writeAtomic(sampleVfs(), target, { write: failingWrite }).catch(
      () => undefined,
    );

    expect(await readdir(parent)).toEqual(['empty-target']);
    expect(await readdir(target)).toEqual([]);
  });

  test('does not clean up or touch anything after a successful write', async () => {
    const target = path.join(parent, 'ok');

    await writeAtomic(sampleVfs(), target);

    expect(await readdir(parent)).toEqual(['ok']);
    expect((await stat(path.join(target, 'package.json'))).isFile()).toBe(true);
  });
});
