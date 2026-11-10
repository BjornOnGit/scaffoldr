import {
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
import { writeVfs } from './write.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'scaffoldr-write-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('writeVfs', () => {
  test('writes the files to a temp dir and reads them back', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 0, 255, 10, 13]);
    const vfs = new VFS();
    vfs.set('package.json', '{ "name": "demo" }\n', 'next-app');
    vfs.set(
      'src/lib/paystack.ts',
      'export const key = "ü";\n',
      'payments-paystack',
    );
    vfs.set('public/img/logo.png', bytes, 'ui-shadcn');

    await writeVfs(vfs, root);

    expect(await readFile(path.join(root, 'package.json'), 'utf8')).toBe(
      '{ "name": "demo" }\n',
    );
    expect(
      await readFile(path.join(root, 'src', 'lib', 'paystack.ts'), 'utf8'),
    ).toBe('export const key = "ü";\n');
    expect(
      new Uint8Array(
        await readFile(path.join(root, 'public', 'img', 'logo.png')),
      ),
    ).toEqual(bytes);
  });

  test('creates the target folder when it does not exist yet', async () => {
    const target = path.join(root, 'new', 'project');
    const vfs = new VFS();
    vfs.set('a/b/c.txt', 'deep', 'owner');

    await writeVfs(vfs, target);

    expect(await readFile(path.join(target, 'a', 'b', 'c.txt'), 'utf8')).toBe(
      'deep',
    );
  });

  test('writes text exactly as given, including line endings', async () => {
    const vfs = new VFS();
    vfs.set('crlf.txt', 'one\r\ntwo\r\n', 'owner');

    await writeVfs(vfs, root);

    expect(await readFile(path.join(root, 'crlf.txt'), 'utf8')).toBe(
      'one\r\ntwo\r\n',
    );
  });

  test('replaces a file that already exists', async () => {
    await writeFile(path.join(root, 'a.txt'), 'old');
    const vfs = new VFS();
    vfs.set('a.txt', 'new', 'owner');

    await writeVfs(vfs, root);

    expect(await readFile(path.join(root, 'a.txt'), 'utf8')).toBe('new');
  });

  test('writes nothing for an empty VFS', async () => {
    await writeVfs(new VFS(), root);

    expect(await readdir(root)).toEqual([]);
  });

  test.each(['../outside.txt', '/abs/path.txt', 'a/../../outside.txt'])(
    'refuses the unsafe path %j and writes nothing at all',
    async (unsafePath) => {
      const vfs = new VFS();
      vfs.set('safe.txt', 'safe', 'owner');
      vfs.set(unsafePath, 'bad', 'owner');

      const error = await writeVfs(vfs, root).catch(
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(ScaffoldrError);
      expect((error as ScaffoldrError).code).toBe('UNSAFE_PATH');
      expect(await readdir(root)).toEqual([]);
      await expect(
        stat(path.join(root, '..', 'outside.txt')),
      ).rejects.toThrow();
    },
  );
});
