/// <reference types="node" />

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveInside } from '../fs-safe/resolve-inside.js';
import type { VFS } from '../vfs/vfs.js';

/**
 * Writes every file in `vfs` under `dir`, creating folders as needed and replacing files that
 * already exist. Every path is checked with `resolveInside` before anything is written, so a
 * VFS holding an unsafe path throws `UNSAFE_PATH` and leaves the disk untouched.
 */
export async function writeVfs(vfs: VFS, dir: string): Promise<void> {
  const targets = vfs.list().map((relPath) => ({
    relPath,
    absPath: resolveInside(dir, relPath),
  }));

  for (const { relPath, absPath } of targets) {
    const entry = vfs.get(relPath);
    if (entry === undefined) {
      continue;
    }
    await mkdir(path.dirname(absPath), { recursive: true });
    await writeFile(absPath, entry.content);
  }
}
