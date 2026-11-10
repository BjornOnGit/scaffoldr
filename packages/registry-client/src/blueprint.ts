/// <reference types="node" />

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { ScaffoldrError } from '@scaffoldr/errors';
import {
  type BlueprintManifest,
  blueprintManifestSchema,
  idSchema,
} from '@scaffoldr/schema';
import type { LoadOptions } from './layer.js';
import { readManifest } from './manifest.js';
import { getRegistryRoot } from './root.js';

export interface LoadedBlueprint {
  manifest: BlueprintManifest;
  /** The blueprint's own folder, `<registry>/blueprints/<id>`. */
  dir: string;
}

async function listBlueprintIds(blueprintsDir: string): Promise<string[]> {
  try {
    const entries = await readdir(blueprintsDir, { withFileTypes: true });
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
 * Reads `<registry>/blueprints/<id>/blueprint.json` and returns the checked manifest with the
 * blueprint's folder. Throws `UNKNOWN_BLUEPRINT` if there is no such blueprint, including when
 * `id` is not a valid id, so an id can never point outside the `blueprints` folder. Throws
 * `INVALID_CONFIG` if the manifest is broken or declares a different id than its folder name.
 */
export async function loadBlueprint(
  id: string,
  options: LoadOptions = {},
): Promise<LoadedBlueprint> {
  const blueprintsDir = path.join(
    options.registryRoot ?? getRegistryRoot(),
    'blueprints',
  );
  const dir = path.join(blueprintsDir, id);

  if (!idSchema.safeParse(id).success || !(await isDirectory(dir))) {
    throw new ScaffoldrError(
      'UNKNOWN_BLUEPRINT',
      `There is no blueprint called "${id}".`,
      {
        hint: 'Run `scaffoldr list` to see the available blueprints.',
        details: { id, available: await listBlueprintIds(blueprintsDir) },
      },
    );
  }

  const file = path.join(dir, 'blueprint.json');
  const manifest = await readManifest(file, blueprintManifestSchema);
  if (manifest.id !== id) {
    throw new ScaffoldrError(
      'INVALID_CONFIG',
      `"${file}" declares the id "${manifest.id}", but its folder is called "${id}".`,
      {
        hint: 'Make the "id" in blueprint.json match the folder name.',
        details: { file, expected: id, actual: manifest.id },
      },
    );
  }
  return { manifest, dir };
}
