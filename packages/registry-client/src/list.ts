/// <reference types="node" />

import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import type {
  BlueprintManifest,
  LayerManifest,
  ModuleManifest,
} from '@scaffoldr/schema';
import { idSchema } from '@scaffoldr/schema';
import { loadBlueprint } from './blueprint.js';
import { loadLayer } from './layer.js';
import type { LoadOptions } from './layer.js';
import { loadModule } from './module.js';
import { getRegistryRoot } from './root.js';

/** Folder names that are valid ids, sorted. Anything else in the folder is not content. */
async function contentIds(kindDir: string): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(kindDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter(
      (entry) => entry.isDirectory() && idSchema.safeParse(entry.name).success,
    )
    .map((entry) => entry.name)
    .sort();
}

async function listAll<T>(
  kind: 'layers' | 'blueprints' | 'modules',
  options: LoadOptions,
  load: (id: string, options: LoadOptions) => Promise<{ manifest: T }>,
): Promise<T[]> {
  const registryRoot = options.registryRoot ?? getRegistryRoot();
  const manifests: T[] = [];
  // One at a time, so a broken manifest is always reported the same way.
  for (const id of await contentIds(path.join(registryRoot, kind))) {
    manifests.push((await load(id, { registryRoot })).manifest);
  }
  return manifests;
}

/**
 * Every layer in the registry, sorted by id. Only folders whose names are valid ids count.
 * A broken layer throws the same `INVALID_CONFIG` error that `loadLayer` would.
 */
export function listLayers(
  options: LoadOptions = {},
): Promise<LayerManifest[]> {
  return listAll('layers', options, loadLayer);
}

/** Every blueprint in the registry, sorted by id. See `listLayers` for the rules. */
export function listBlueprints(
  options: LoadOptions = {},
): Promise<BlueprintManifest[]> {
  return listAll('blueprints', options, loadBlueprint);
}

/** Every module in the registry, sorted by id. See `listLayers` for the rules. */
export function listModules(
  options: LoadOptions = {},
): Promise<ModuleManifest[]> {
  return listAll('modules', options, loadModule);
}
