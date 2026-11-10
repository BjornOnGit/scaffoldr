import { describe, expect, test } from 'vitest';
import { VFS } from './vfs.js';

describe('VFS', () => {
  test('set and get round trip a string file', () => {
    const vfs = new VFS();
    vfs.set('src/index.ts', 'export {};\n', 'next-app');

    expect(vfs.get('src/index.ts')).toEqual({
      content: 'export {};\n',
      owner: 'next-app',
    });
  });

  test('set and get round trip binary content', () => {
    const vfs = new VFS();
    const bytes = new Uint8Array([137, 80, 78, 71]);
    vfs.set('public/logo.png', bytes, 'ui-shadcn');

    const entry = vfs.get('public/logo.png');
    expect(entry?.content).toEqual(bytes);
    expect(entry?.owner).toBe('ui-shadcn');
  });

  test('get returns undefined and has returns false for a missing file', () => {
    const vfs = new VFS();

    expect(vfs.get('nope.txt')).toBeUndefined();
    expect(vfs.has('nope.txt')).toBe(false);
  });

  test('has returns true after set', () => {
    const vfs = new VFS();
    vfs.set('a.txt', 'a', 'x');

    expect(vfs.has('a.txt')).toBe(true);
  });

  test('normalises a\\b to a/b', () => {
    const vfs = new VFS();
    vfs.set('a\\b', 'content', 'owner');

    expect(vfs.list()).toEqual(['a/b']);
    expect(vfs.has('a/b')).toBe(true);
    expect(vfs.has('a\\b')).toBe(true);
    expect(vfs.get('a/b')?.content).toBe('content');
  });

  test.each([
    ['./a/b', 'a/b'],
    ['a//b', 'a/b'],
    ['a/./b', 'a/b'],
    ['a/b/', 'a/b'],
    ['a\\.\\b', 'a/b'],
    ['a\\\\b', 'a/b'],
  ])('normalises %j to %j', (input, expected) => {
    const vfs = new VFS();
    vfs.set(input, 'x', 'owner');

    expect(vfs.list()).toEqual([expected]);
  });

  test('keeps ".." and a leading slash as written so path safety can reject them later', () => {
    const vfs = new VFS();
    vfs.set('../x', 'x', 'owner');
    vfs.set('/abs', 'x', 'owner');
    vfs.set('\\abs2', 'x', 'owner');

    expect(vfs.list()).toEqual(['../x', '/abs', '/abs2']);
  });

  test('list returns paths sorted', () => {
    const vfs = new VFS();
    vfs.set('src/z.ts', 'z', 'owner');
    vfs.set('b.txt', 'b', 'owner');
    vfs.set('src/a.ts', 'a', 'owner');
    vfs.set('a.txt', 'a', 'owner');

    expect(vfs.list()).toEqual(['a.txt', 'b.txt', 'src/a.ts', 'src/z.ts']);
  });

  test('list is empty for a new VFS', () => {
    expect(new VFS().list()).toEqual([]);
  });

  test('setting an existing path replaces its content and owner', () => {
    const vfs = new VFS();
    vfs.set('a.txt', 'first', 'one');
    vfs.set('./a.txt', 'second', 'two');

    expect(vfs.list()).toEqual(['a.txt']);
    expect(vfs.get('a.txt')).toEqual({ content: 'second', owner: 'two' });
  });

  test('delete removes a file', () => {
    const vfs = new VFS();
    vfs.set('a.txt', 'a', 'one');
    vfs.set('b.txt', 'b', 'one');
    vfs.delete('a.txt');

    expect(vfs.has('a.txt')).toBe(false);
    expect(vfs.list()).toEqual(['b.txt']);
  });

  test('delete finds a file by any spelling of its path', () => {
    const vfs = new VFS();
    vfs.set('a/b.txt', 'x', 'one');
    vfs.delete('.\\a\\b.txt');

    expect(vfs.list()).toEqual([]);
  });

  test('deleting a missing path is a no-op', () => {
    const vfs = new VFS();
    vfs.set('a.txt', 'a', 'one');

    expect(() => vfs.delete('missing.txt')).not.toThrow();
    expect(vfs.list()).toEqual(['a.txt']);
  });

  test('rename moves a file and preserves content and owner', () => {
    const vfs = new VFS();
    const bytes = new Uint8Array([1, 2, 3]);
    vfs.set('old/logo.bin', bytes, 'ui-shadcn');
    vfs.rename('old/logo.bin', 'new/logo.bin');

    expect(vfs.has('old/logo.bin')).toBe(false);
    expect(vfs.get('new/logo.bin')).toEqual({
      content: bytes,
      owner: 'ui-shadcn',
    });
  });

  test('rename normalises both paths', () => {
    const vfs = new VFS();
    vfs.set('a.txt', 'a', 'one');
    vfs.rename('.\\a.txt', 'dir\\b.txt');

    expect(vfs.list()).toEqual(['dir/b.txt']);
  });

  test('rename replaces an existing file at the destination', () => {
    const vfs = new VFS();
    vfs.set('a.txt', 'from a', 'one');
    vfs.set('b.txt', 'from b', 'two');
    vfs.rename('a.txt', 'b.txt');

    expect(vfs.list()).toEqual(['b.txt']);
    expect(vfs.get('b.txt')).toEqual({ content: 'from a', owner: 'one' });
  });

  test('renaming a missing path is a no-op', () => {
    const vfs = new VFS();
    vfs.set('a.txt', 'a', 'one');
    vfs.rename('missing.txt', 'b.txt');

    expect(vfs.list()).toEqual(['a.txt']);
  });

  test('renaming a file to itself keeps it', () => {
    const vfs = new VFS();
    vfs.set('a.txt', 'a', 'one');
    vfs.rename('a.txt', './a.txt');

    expect(vfs.get('a.txt')).toEqual({ content: 'a', owner: 'one' });
  });
});

describe('ownership queries', () => {
  function twoOwners(): VFS {
    const vfs = new VFS();
    vfs.set('package.json', '{}', 'next-app');
    vfs.set('src/app.ts', 'app', 'next-app');
    vfs.set('src/lib/paystack.ts', 'pay', 'payments-paystack');
    vfs.set('src/env.ts', 'env', 'payments-paystack');
    vfs.set('src/z.ts', 'z', 'next-app');
    return vfs;
  }

  test('ownerOf returns the owner of each file', () => {
    const vfs = twoOwners();

    expect(vfs.ownerOf('package.json')).toBe('next-app');
    expect(vfs.ownerOf('src/lib/paystack.ts')).toBe('payments-paystack');
  });

  test('ownerOf normalises the path and returns undefined for a missing file', () => {
    const vfs = twoOwners();

    expect(vfs.ownerOf('.\\src\\env.ts')).toBe('payments-paystack');
    expect(vfs.ownerOf('missing.ts')).toBeUndefined();
  });

  test("filesOwnedBy lists each owner's files, sorted, with no overlap", () => {
    const vfs = twoOwners();

    expect(vfs.filesOwnedBy('next-app')).toEqual([
      'package.json',
      'src/app.ts',
      'src/z.ts',
    ]);
    expect(vfs.filesOwnedBy('payments-paystack')).toEqual([
      'src/env.ts',
      'src/lib/paystack.ts',
    ]);
  });

  test('filesOwnedBy returns an empty list for an unknown owner', () => {
    expect(twoOwners().filesOwnedBy('nobody')).toEqual([]);
  });

  test('overwriting a file moves it from one owner to the other', () => {
    const vfs = twoOwners();
    vfs.set('src/app.ts', 'patched', 'payments-paystack');

    expect(vfs.ownerOf('src/app.ts')).toBe('payments-paystack');
    expect(vfs.filesOwnedBy('next-app')).toEqual(['package.json', 'src/z.ts']);
    expect(vfs.filesOwnedBy('payments-paystack')).toEqual([
      'src/app.ts',
      'src/env.ts',
      'src/lib/paystack.ts',
    ]);
  });

  test('rename keeps ownership and delete removes it', () => {
    const vfs = twoOwners();
    vfs.rename('src/env.ts', 'src/config/env.ts');
    vfs.delete('src/z.ts');

    expect(vfs.ownerOf('src/config/env.ts')).toBe('payments-paystack');
    expect(vfs.ownerOf('src/env.ts')).toBeUndefined();
    expect(vfs.filesOwnedBy('next-app')).toEqual([
      'package.json',
      'src/app.ts',
    ]);
    expect(vfs.filesOwnedBy('payments-paystack')).toEqual([
      'src/config/env.ts',
      'src/lib/paystack.ts',
    ]);
  });
});
