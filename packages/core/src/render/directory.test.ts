import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { ScaffoldrError } from '../errors/index.js';
import { VFS } from '../vfs/vfs.js';
import { renderDirectory } from './directory.js';

const logoBytes = new Uint8Array([137, 80, 78, 71, 0, 255]);

let srcDir: string;

async function addFile(
  rel: string,
  content: string | Uint8Array,
): Promise<void> {
  const file = path.join(srcDir, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

beforeEach(async () => {
  srcDir = await mkdtemp(path.join(tmpdir(), 'scaffoldr-render-'));
});

afterEach(async () => {
  await rm(srcDir, { recursive: true, force: true });
});

/** The fixture: one plain text file, one .hbs template, one binary file. */
async function addFixture(): Promise<void> {
  await addFile('README.md', 'Use {{ braces }} freely here.\n');
  await addFile('src/config.ts.hbs', 'export const name = "{{name}}";\n');
  await addFile('public/logo.bin', logoBytes);
}

describe('renderDirectory', () => {
  test('a fixture of three files produces the expected VFS', async () => {
    await addFixture();
    const vfs = new VFS();

    await renderDirectory(srcDir, { name: 'Detty Night' }, 'next-app', vfs);

    expect(vfs.list()).toEqual([
      'README.md',
      'public/logo.bin',
      'src/config.ts',
    ]);
    expect(vfs.get('README.md')).toEqual({
      content: 'Use {{ braces }} freely here.\n',
      owner: 'next-app',
    });
    expect(vfs.get('src/config.ts')).toEqual({
      content: 'export const name = "Detty Night";\n',
      owner: 'next-app',
    });
    expect(vfs.get('public/logo.bin')).toEqual({
      content: logoBytes,
      owner: 'next-app',
    });
  });

  test('stores the binary file as bytes and the text files as strings', async () => {
    await addFixture();
    const vfs = new VFS();

    await renderDirectory(srcDir, { name: 'x' }, 'next-app', vfs);

    expect(vfs.get('public/logo.bin')?.content).toBeInstanceOf(Uint8Array);
    expect(typeof vfs.get('README.md')?.content).toBe('string');
  });

  test('puts every file under the prefix', async () => {
    await addFixture();
    const vfs = new VFS();

    await renderDirectory(srcDir, { name: 'x' }, 'next-app', vfs, {
      prefix: 'apps/web/',
    });

    expect(vfs.list()).toEqual([
      'apps/web/README.md',
      'apps/web/public/logo.bin',
      'apps/web/src/config.ts',
    ]);
  });

  test('applies path tokens and the _gitignore rename to the walk', async () => {
    await addFile('__slug__/page.tsx.hbs', 'title: {{title}}\n');
    await addFile('_gitignore', 'node_modules\n');
    const vfs = new VFS();

    await renderDirectory(
      srcDir,
      { slug: 'detty', title: 'Detty' },
      'blueprint',
      vfs,
    );

    expect(vfs.list()).toEqual(['.gitignore', 'detty/page.tsx']);
    expect(vfs.get('detty/page.tsx')?.content).toBe('title: Detty\n');
  });

  test('keeps a byte order mark and treats invalid UTF-8 as binary', async () => {
    await addFile('bom.txt', '\uFEFFhello');
    await addFile('latin1.bin', new Uint8Array([0xc3, 0x28]));
    const vfs = new VFS();

    await renderDirectory(srcDir, {}, 'owner', vfs);

    expect(vfs.get('bom.txt')?.content).toBe('\uFEFFhello');
    expect(vfs.get('latin1.bin')?.content).toEqual(
      new Uint8Array([0xc3, 0x28]),
    );
  });

  test('an empty folder adds nothing', async () => {
    await mkdir(path.join(srcDir, 'empty'));
    const vfs = new VFS();

    await renderDirectory(srcDir, {}, 'owner', vfs);

    expect(vfs.list()).toEqual([]);
  });

  test('throws INVALID_CONFIG when a template needs a missing variable', async () => {
    await addFile('a.txt.hbs', '{{missing}}');
    const error = await renderDirectory(srcDir, {}, 'owner', new VFS()).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ScaffoldrError);
    expect((error as ScaffoldrError).code).toBe('INVALID_CONFIG');
  });

  test('refuses a symbolic link', async () => {
    await addFile('real.txt', 'x');
    await symlink(path.join(srcDir, 'real.txt'), path.join(srcDir, 'link.txt'));
    const error = await renderDirectory(srcDir, {}, 'owner', new VFS()).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ScaffoldrError);
    expect((error as ScaffoldrError).code).toBe('UNSAFE_PATH');
  });
});
