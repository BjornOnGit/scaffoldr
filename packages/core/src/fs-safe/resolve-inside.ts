/// <reference types="node" />

import path from 'node:path';
import { ScaffoldrError } from '../errors/index.js';

function unsafe(root: string, rel: string, reason: string): ScaffoldrError {
  return new ScaffoldrError('UNSAFE_PATH', `Refusing to use "${rel}": ${reason}.`, {
    hint: 'Use a path relative to the project folder that does not contain "..".',
    details: { root, path: rel },
  });
}

/**
 * Resolves `rel` against `root` and returns the absolute path.
 * Throws `UNSAFE_PATH` if `rel` is absolute (POSIX or Windows style), contains a NUL
 * character, or would end up outside `root`. Backslashes count as separators on every platform.
 */
export function resolveInside(root: string, rel: string): string {
  if (rel.includes('\0')) {
    throw unsafe(root, rel, 'it contains a NUL character');
  }
  if (path.posix.isAbsolute(rel) || path.win32.isAbsolute(rel) || /^[a-zA-Z]:/.test(rel)) {
    throw unsafe(root, rel, 'it is an absolute path');
  }

  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, rel.replaceAll('\\', '/'));
  const fromRoot = path.relative(resolvedRoot, resolved);

  if (fromRoot === '..' || fromRoot.startsWith(`..${path.sep}`) || path.isAbsolute(fromRoot)) {
    throw unsafe(root, rel, 'it points outside the project folder');
  }
  return resolved;
}