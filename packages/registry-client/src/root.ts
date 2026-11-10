/// <reference types="node" />

import { statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ScaffoldrError } from '@scaffoldr/errors';

export interface RegistryRootOptions {
  /** Environment variables to read. Defaults to `process.env`. For tests. */
  env?: Record<string, string | undefined>;
  /** The folder this code runs from. Defaults to the folder of this file. For tests. */
  moduleDir?: string;
}

function isDirectory(target: string): boolean {
  try {
    return statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function isFile(target: string): boolean {
  try {
    return statSync(target).isFile();
  } catch {
    return false;
  }
}

function missing(
  message: string,
  details: Record<string, unknown>,
): ScaffoldrError {
  return new ScaffoldrError('INVALID_CONFIG', message, {
    hint: 'Pass --registry <path> or set SCAFFOLDR_REGISTRY to a registry folder.',
    details,
  });
}

/** A path the user chose on purpose has to exist; it is never silently replaced. */
function chosen(source: string, value: string): string {
  const resolved = path.resolve(value);
  if (!isDirectory(resolved)) {
    throw missing(
      `The registry folder from ${source} does not exist: "${resolved}".`,
      {
        source,
        path: resolved,
      },
    );
  }
  return resolved;
}

/**
 * Finds the folder that holds the registry content. In order:
 * 1. `override` (for example from `--registry`);
 * 2. the `SCAFFOLDR_REGISTRY` environment variable;
 * 3. the repo's own `registry/` folder, when running from the scaffoldr monorepo;
 * 4. the `registry/` folder shipped next to this code in a published package.
 *
 * A folder chosen in 1 or 2 must exist, or `INVALID_CONFIG` is thrown. So is it when 3 and 4
 * both come up empty.
 */
export function getRegistryRoot(
  override?: string,
  options: RegistryRootOptions = {},
): string {
  if (override !== undefined && override !== '') {
    return chosen('the registry option', override);
  }

  const env = options.env ?? process.env;
  const fromEnv = env.SCAFFOLDR_REGISTRY;
  if (fromEnv !== undefined && fromEnv !== '') {
    return chosen('SCAFFOLDR_REGISTRY', fromEnv);
  }

  const moduleDir =
    options.moduleDir ?? path.dirname(fileURLToPath(import.meta.url));

  // Source and built files both sit two folders below `packages/`, so the repo root is three up.
  // The workspace file tells the real monorepo apart from an unrelated folder named `registry`.
  const repoRoot = path.resolve(moduleDir, '..', '..', '..');
  const devRegistry = path.join(repoRoot, 'registry');
  if (
    isDirectory(devRegistry) &&
    isFile(path.join(repoRoot, 'pnpm-workspace.yaml'))
  ) {
    return devRegistry;
  }

  const bundledRegistry = path.resolve(moduleDir, '..', 'registry');
  if (isDirectory(bundledRegistry)) {
    return bundledRegistry;
  }

  throw missing('Could not find the scaffoldr registry.', {
    tried: [devRegistry, bundledRegistry],
  });
}
