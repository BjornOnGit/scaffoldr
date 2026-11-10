/// <reference types="node" />

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { ScaffoldrError } from '@scaffoldr/errors';
import {
  type LayerManifest,
  idSchema,
  layerManifestSchema,
} from '@scaffoldr/schema';
import { readManifest } from './manifest.js';
import { getRegistryRoot } from './root.js';

export interface LoadOptions {
  /** The registry folder to read from. Defaults to `getRegistryRoot()`. */
  registryRoot?: string;
}

export interface LoadedLayer {
  manifest: LayerManifest;
  /** The layer's own folder, `<registry>/layers/<id>`. */
  dir: string;
}

async function listLayerIds(layersDir: string): Promise<string[]> {
  try {
    const entries = await readdir(layersDir, { withFileTypes: true });
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
 * Reads `<registry>/layers/<id>/layer.json` and returns the checked manifest with the layer's
 * folder. Throws `UNKNOWN_LAYER` if there is no such layer, including when `id` is not a valid
 * id, so an id can never point outside the `layers` folder. Throws `INVALID_CONFIG` if the
 * manifest is broken or declares a different id than its folder name.
 */
export async function loadLayer(
  id: string,
  options: LoadOptions = {},
): Promise<LoadedLayer> {
  const layersDir = path.join(
    options.registryRoot ?? getRegistryRoot(),
    'layers',
  );
  const dir = path.join(layersDir, id);

  if (!idSchema.safeParse(id).success || !(await isDirectory(dir))) {
    throw new ScaffoldrError(
      'UNKNOWN_LAYER',
      `There is no layer called "${id}".`,
      {
        hint: 'Run `scaffoldr list` to see the available layers.',
        details: { id, available: await listLayerIds(layersDir) },
      },
    );
  }

  const file = path.join(dir, 'layer.json');
  const manifest = await readManifest(file, layerManifestSchema);
  if (manifest.id !== id) {
    throw new ScaffoldrError(
      'INVALID_CONFIG',
      `"${file}" declares the id "${manifest.id}", but its folder is called "${id}".`,
      {
        hint: 'Make the "id" in layer.json match the folder name.',
        details: { file, expected: id, actual: manifest.id },
      },
    );
  }
  return { manifest, dir };
}
