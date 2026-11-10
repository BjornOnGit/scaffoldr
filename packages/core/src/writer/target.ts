/// <reference types="node" />

import { readdir } from 'node:fs/promises';
import { ScaffoldrError } from '../errors/index.js';

function notEmpty(
  dir: string,
  reason: string,
  existing: string[],
): ScaffoldrError {
  return new ScaffoldrError(
    'TARGET_NOT_EMPTY',
    `Cannot generate into "${dir}": ${reason}.`,
    {
      hint: 'Choose a new folder name, or empty the folder first.',
      details: { dir, existing },
    },
  );
}

/**
 * Passes if `dir` does not exist or is an empty folder. Throws `TARGET_NOT_EMPTY` if it holds
 * anything at all (hidden files and empty subfolders count) or if it is a file, not a folder.
 */
export async function assertTargetWritable(dir: string): Promise<void> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ENOENT') {
      return;
    }
    if (code === 'ENOTDIR') {
      throw notEmpty(dir, 'a file with that name already exists', []);
    }
    throw error;
  }

  if (names.length > 0) {
    throw notEmpty(dir, 'the folder is not empty', names.sort().slice(0, 5));
  }
}
