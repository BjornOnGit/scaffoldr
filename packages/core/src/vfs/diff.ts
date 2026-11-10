/// <reference types="node" />

import { readFile } from 'node:fs/promises';
import { resolveInside } from '../fs-safe/resolve-inside.js';
import type { VFS } from './vfs.js';

export interface DiskDiff {
  /** Files in the VFS that do not exist on disk. */
  added: string[];
  /** Files that exist on disk with different content. */
  modified: string[];
  /** Files that exist on disk with identical content. */
  unchanged: string[];
}

/**
 * Compares every file in the VFS with the file at the same path under `rootDir`, byte for byte.
 * Files that exist only on disk are not reported. Each list is sorted like `vfs.list()`.
 * Throws `UNSAFE_PATH` if a VFS path would resolve outside `rootDir`.
 */
export async function diffAgainstDisk(
  vfs: VFS,
  rootDir: string,
): Promise<DiskDiff> {
  const diff: DiskDiff = { added: [], modified: [], unchanged: [] };

  for (const path of vfs.list()) {
    const entry = vfs.get(path);
    if (entry === undefined) {
      continue;
    }
    const wanted =
      typeof entry.content === 'string'
        ? Buffer.from(entry.content, 'utf8')
        : entry.content;

    let onDisk: Buffer;
    try {
      onDisk = await readFile(resolveInside(rootDir, path));
    } catch (error) {
      if (isMissingFileError(error)) {
        diff.added.push(path);
        continue;
      }
      throw error;
    }

    if (Buffer.from(wanted).equals(onDisk)) {
      diff.unchanged.push(path);
    } else {
      diff.modified.push(path);
    }
  }

  return diff;
}

function isMissingFileError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === 'ENOENT' || code === 'ENOTDIR';
}
