/// <reference types="node" />

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { ScaffoldrError } from '../errors/index.js';
import type { VFS } from '../vfs/vfs.js';
import { renderFile } from './file.js';

export interface RenderDirectoryOptions {
  /** A folder to put every rendered file under, such as `apps/web`. */
  prefix?: string;
}

/** Valid UTF-8 without NUL bytes counts as text. Anything else is kept as raw bytes. */
function toContent(bytes: Uint8Array): string | Uint8Array {
  if (bytes.includes(0)) {
    return bytes;
  }
  try {
    // ignoreBOM keeps a leading byte order mark, so the text round-trips exactly.
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    return bytes;
  }
}

/** Lists every file under `dir` as a `/`-separated path, in a stable order. */
async function listFiles(dir: string, relDir = ''): Promise<string[]> {
  const entries = await readdir(path.join(dir, relDir), {
    withFileTypes: true,
  });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const files: string[] = [];
  for (const entry of entries) {
    const rel = relDir === '' ? entry.name : `${relDir}/${entry.name}`;
    if (entry.isSymbolicLink()) {
      throw new ScaffoldrError(
        'UNSAFE_PATH',
        `Refusing to follow the symbolic link "${rel}".`,
        {
          hint: 'Registry content must not contain symbolic links.',
          details: { dir, path: rel },
        },
      );
    }
    if (entry.isDirectory()) {
      files.push(...(await listFiles(dir, rel)));
    } else if (entry.isFile()) {
      files.push(rel);
    }
  }
  return files;
}

/**
 * Walks `srcDir`, renders every file with `renderFile` and adds the results to `vfs`,
 * owned by `owner`. Text files become strings; binary files stay as bytes.
 * Throws `UNSAFE_PATH` if the folder contains a symbolic link.
 */
export async function renderDirectory(
  srcDir: string,
  ctx: Record<string, unknown>,
  owner: string,
  vfs: VFS,
  options: RenderDirectoryOptions = {},
): Promise<void> {
  const prefix = (options.prefix ?? '').replace(/[\\/]+$/, '');

  for (const relPath of await listFiles(srcDir)) {
    const bytes = await readFile(path.join(srcDir, relPath));
    const rendered = renderFile(
      relPath,
      toContent(Uint8Array.from(bytes)),
      ctx,
    );
    const target = prefix === '' ? rendered.path : `${prefix}/${rendered.path}`;
    vfs.set(target, rendered.content, owner);
  }
}
