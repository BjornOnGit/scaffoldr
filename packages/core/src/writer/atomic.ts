/// <reference types="node" />

import { mkdir, mkdtemp, rename, rm, rmdir } from 'node:fs/promises';
import path from 'node:path';
import type { VFS } from '../vfs/vfs.js';
import { assertTargetWritable } from './target.js';
import { writeVfs } from './write.js';

export interface WriteAtomicOptions {
  /** How files get written into the temporary folder. Defaults to `writeVfs`. For tests. */
  write?: (vfs: VFS, dir: string) => Promise<void>;
}

/**
 * Writes the VFS into a temporary folder next to `targetDir` and then renames it into place,
 * so `targetDir` is either missing or complete, never half written.
 *
 * The target must not exist or must be empty (`TARGET_NOT_EMPTY` otherwise). The temporary
 * folder is a sibling so the rename stays on one file system. If anything fails after the
 * temporary folder exists, it is removed and the original error is thrown again.
 */
export async function writeAtomic(
  vfs: VFS,
  targetDir: string,
  options: WriteAtomicOptions = {},
): Promise<void> {
  const write = options.write ?? writeVfs;
  const target = path.resolve(targetDir);
  await assertTargetWritable(target);

  const parent = path.dirname(target);
  await mkdir(parent, { recursive: true });
  const tempDir = await mkdtemp(
    path.join(parent, `.${path.basename(target)}-scaffoldr-`),
  );

  try {
    await write(vfs, tempDir);

    // An existing empty folder has to go first, because Windows cannot rename over a folder.
    // `rmdir` only removes empty folders, so real content is never deleted here.
    try {
      await rmdir(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException | undefined)?.code !== 'ENOENT') {
        throw error;
      }
    }
    await rename(tempDir, target);
  } catch (error) {
    // Clean up, but never let a failed cleanup hide the error that caused it.
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}
