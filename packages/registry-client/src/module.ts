/// <reference types="node" />

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { ScaffoldrError } from '@scaffoldr/errors';
import {
  type ModuleManifest,
  idSchema,
  moduleManifestSchema,
} from '@scaffoldr/schema';
import type { LoadOptions } from './layer.js';
import { readManifest } from './manifest.js';
import { getRegistryRoot } from './root.js';

export interface LoadedModule {
  manifest: ModuleManifest;
  /** The module's own folder, `<registry>/modules/<id>`. */
  dir: string;
}

async function listModuleIds(modulesDir: string): Promise<string[]> {
  try {
    const entries = await readdir(modulesDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Reads `<registry>/modules/<id>/module.json` and returns the checked manifest with the
 * module's folder. Throws `UNKNOWN_MODULE` if there is no such module, including when `id` is
 * not a valid id, so an id can never point outside the `modules` folder. Throws
 * `INVALID_CONFIG` if the manifest is broken or declares a different id than its folder name.
 */
export async function loadModule(
  id: string,
  options: LoadOptions = {},
): Promise<LoadedModule> {
  const modulesDir = path.join(
    options.registryRoot ?? getRegistryRoot(),
    'modules',
  );
  const dir = path.join(modulesDir, id);

  if (!idSchema.safeParse(id).success || !(await isDirectory(dir))) {
    throw new ScaffoldrError(
      'UNKNOWN_MODULE',
      `There is no module called "${id}".`,
      {
        hint: 'Run `scaffoldr list` to see the available modules.',
        details: { id, available: await listModuleIds(modulesDir) },
      },
    );
  }

  const file = path.join(dir, 'module.json');
  const manifest = await readManifest(file, moduleManifestSchema);
  if (manifest.id !== id) {
    throw new ScaffoldrError(
      'INVALID_CONFIG',
      `"${file}" declares the id "${manifest.id}", but its folder is called "${id}".`,
      {
        hint: 'Make the "id" in module.json match the folder name.',
        details: { file, expected: id, actual: manifest.id },
      },
    );
  }
  return { manifest, dir };
}
