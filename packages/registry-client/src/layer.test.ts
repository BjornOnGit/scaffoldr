import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ScaffoldrError } from '@scaffoldr/errors';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { loadLayer } from './layer.js';

let registryRoot: string;

beforeEach(async () => {
  registryRoot = await mkdtemp(path.join(tmpdir(), 'scaffoldr-registry-'));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(registryRoot, { recursive: true, force: true });
});

function layerJson(id: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id,
    name: `Layer ${id}`,
    engines: { node: '>=20', scaffoldr: '^0.1.0' },
    injectionPoints: ['providers'],
    ...extra,
  });
}

async function addLayer(folder: string, json: string): Promise<string> {
  const dir = path.join(registryRoot, 'layers', folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'layer.json'), json);
  return dir;
}

async function errorFrom(promise: Promise<unknown>): Promise<ScaffoldrError> {
  const error = await promise.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ScaffoldrError);
  return error as ScaffoldrError;
}

describe('loadLayer', () => {
  test('returns the manifest and the layer folder from a fixture registry', async () => {
    const dir = await addLayer('next-app', layerJson('next-app'));
    await addLayer('vite-react', layerJson('vite-react'));

    const layer = await loadLayer('next-app', { registryRoot });

    expect(layer.dir).toBe(dir);
    expect(layer.manifest).toEqual({
      id: 'next-app',
      name: 'Layer next-app',
      engines: { node: '>=20', scaffoldr: '^0.1.0' },
      injectionPoints: ['providers'],
    });
  });

  test('throws UNKNOWN_LAYER for an unknown id and lists the available layers', async () => {
    await addLayer('vite-react', layerJson('vite-react'));
    await addLayer('next-app', layerJson('next-app'));

    const error = await errorFrom(loadLayer('astro', { registryRoot }));

    expect(error.code).toBe('UNKNOWN_LAYER');
    expect(error.message).toContain('"astro"');
    expect(error.hint).toBeTruthy();
    expect(error.details).toEqual({
      id: 'astro',
      available: ['next-app', 'vite-react'],
    });
  });

  test('throws UNKNOWN_LAYER when the registry has no layers folder at all', async () => {
    const error = await errorFrom(loadLayer('next-app', { registryRoot }));

    expect(error.code).toBe('UNKNOWN_LAYER');
    expect(error.details).toEqual({ id: 'next-app', available: [] });
  });

  test.each(['../outside', 'Bad_ID', '', 'a/b', '/etc'])(
    'throws UNKNOWN_LAYER for the invalid id %j and never reads outside layers/',
    async (badId) => {
      await mkdir(path.join(registryRoot, 'outside'), { recursive: true });
      await writeFile(
        path.join(registryRoot, 'outside', 'layer.json'),
        layerJson('outside'),
      );

      const error = await errorFrom(loadLayer(badId, { registryRoot }));

      expect(error.code).toBe('UNKNOWN_LAYER');
    },
  );

  test('throws INVALID_CONFIG when layer.json does not match the schema', async () => {
    await addLayer('next-app', layerJson('next-app', { engines: {} }));

    const error = await errorFrom(loadLayer('next-app', { registryRoot }));

    expect(error.code).toBe('INVALID_CONFIG');
    expect(error.message).toContain('engines.node');
  });

  test('throws INVALID_CONFIG when the layer folder has no layer.json', async () => {
    await mkdir(path.join(registryRoot, 'layers', 'empty-layer'), {
      recursive: true,
    });

    const error = await errorFrom(loadLayer('empty-layer', { registryRoot }));

    expect(error.code).toBe('INVALID_CONFIG');
    expect(error.message).toContain('layer.json');
  });

  test('throws INVALID_CONFIG when the manifest id differs from the folder name', async () => {
    await addLayer('next-app', layerJson('vite-react'));

    const error = await errorFrom(loadLayer('next-app', { registryRoot }));

    expect(error.code).toBe('INVALID_CONFIG');
    expect(error.details).toMatchObject({
      expected: 'next-app',
      actual: 'vite-react',
    });
  });

  test('uses SCAFFOLDR_REGISTRY when no registryRoot is given', async () => {
    const dir = await addLayer('next-app', layerJson('next-app'));
    vi.stubEnv('SCAFFOLDR_REGISTRY', registryRoot);

    const layer = await loadLayer('next-app');

    expect(layer.dir).toBe(dir);
  });
});
