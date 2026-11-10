import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ScaffoldrError } from '@scaffoldr/errors';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { listBlueprints, listLayers, listModules } from './list.js';

let registryRoot: string;

beforeEach(async () => {
  registryRoot = await mkdtemp(path.join(tmpdir(), 'scaffoldr-registry-'));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(registryRoot, { recursive: true, force: true });
});

function layerJson(id: string): string {
  return JSON.stringify({
    id,
    name: `Layer ${id}`,
    engines: { node: '>=20', scaffoldr: '^0.1.0' },
    injectionPoints: [],
  });
}

function blueprintJson(id: string): string {
  return JSON.stringify({
    id,
    name: `Blueprint ${id}`,
    description: `The ${id} blueprint`,
    layer: 'next-app',
    defaults: [],
    slots: {},
    questions: [],
  });
}

function moduleJson(id: string): string {
  return JSON.stringify({
    id,
    name: `Module ${id}`,
    version: '0.1.0',
    supports: {},
  });
}

async function add(
  kind: string,
  id: string,
  fileName: string,
  json: string,
): Promise<void> {
  const dir = path.join(registryRoot, kind, id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), json);
}

/** Two of each, added in reverse order so sorting has to do the work. */
async function addFixture(): Promise<void> {
  await add('layers', 'vite-react', 'layer.json', layerJson('vite-react'));
  await add('layers', 'next-app', 'layer.json', layerJson('next-app'));
  await add(
    'blueprints',
    'ticketing',
    'blueprint.json',
    blueprintJson('ticketing'),
  );
  await add('blueprints', 'docs', 'blueprint.json', blueprintJson('docs'));
  await add(
    'modules',
    'payments-paystack',
    'module.json',
    moduleJson('payments-paystack'),
  );
  await add('modules', 'db-prisma', 'module.json', moduleJson('db-prisma'));
}

describe('list functions with a fixture registry of two of each', () => {
  test('listLayers returns both layers sorted by id', async () => {
    await addFixture();

    const layers = await listLayers({ registryRoot });

    expect(layers.map((layer) => layer.id)).toEqual(['next-app', 'vite-react']);
    expect(layers[0]?.name).toBe('Layer next-app');
  });

  test('listBlueprints returns both blueprints sorted by id', async () => {
    await addFixture();

    const blueprints = await listBlueprints({ registryRoot });

    expect(blueprints.map((blueprint) => blueprint.id)).toEqual([
      'docs',
      'ticketing',
    ]);
    expect(blueprints[1]?.description).toBe('The ticketing blueprint');
  });

  test('listModules returns both modules sorted by id, with defaults filled in', async () => {
    await addFixture();

    const modules = await listModules({ registryRoot });

    expect(modules.map((module) => module.id)).toEqual([
      'db-prisma',
      'payments-paystack',
    ]);
    expect(modules[0]?.files).toEqual([]);
  });

  test('each list only returns its own kind', async () => {
    await addFixture();

    expect(await listLayers({ registryRoot })).toHaveLength(2);
    expect(await listBlueprints({ registryRoot })).toHaveLength(2);
    expect(await listModules({ registryRoot })).toHaveLength(2);
  });
});

describe('list functions: edge cases', () => {
  test('return an empty list when the kind folder does not exist', async () => {
    expect(await listLayers({ registryRoot })).toEqual([]);
    expect(await listBlueprints({ registryRoot })).toEqual([]);
    expect(await listModules({ registryRoot })).toEqual([]);
  });

  test('return an empty list for an empty kind folder', async () => {
    await mkdir(path.join(registryRoot, 'modules'), { recursive: true });

    expect(await listModules({ registryRoot })).toEqual([]);
  });

  test('ignore loose files and folders whose names are not valid ids', async () => {
    await add('modules', 'db-prisma', 'module.json', moduleJson('db-prisma'));
    await writeFile(path.join(registryRoot, 'modules', 'README.md'), 'notes');
    await mkdir(path.join(registryRoot, 'modules', '.cache'), {
      recursive: true,
    });
    await mkdir(path.join(registryRoot, 'modules', 'Not_An_Id'), {
      recursive: true,
    });

    const modules = await listModules({ registryRoot });

    expect(modules.map((module) => module.id)).toEqual(['db-prisma']);
  });

  test('throw INVALID_CONFIG when one manifest is broken, naming its file', async () => {
    await add('modules', 'db-prisma', 'module.json', moduleJson('db-prisma'));
    await add('modules', 'broken-one', 'module.json', '{ "id": "broken-one" }');

    const error = await listModules({ registryRoot }).then(
      () => undefined,
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ScaffoldrError);
    expect((error as ScaffoldrError).code).toBe('INVALID_CONFIG');
    expect((error as ScaffoldrError).message).toContain('broken-one');
  });

  test('throw INVALID_CONFIG when a folder has no manifest file', async () => {
    await mkdir(path.join(registryRoot, 'layers', 'empty-layer'), {
      recursive: true,
    });

    const error = await listLayers({ registryRoot }).then(
      () => undefined,
      (caught: unknown) => caught,
    );

    expect((error as ScaffoldrError).code).toBe('INVALID_CONFIG');
  });

  test('use SCAFFOLDR_REGISTRY when no registryRoot is given', async () => {
    await addFixture();
    vi.stubEnv('SCAFFOLDR_REGISTRY', registryRoot);

    expect((await listLayers()).map((layer) => layer.id)).toEqual([
      'next-app',
      'vite-react',
    ]);
  });
});
