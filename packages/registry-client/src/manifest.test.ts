import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ScaffoldrError } from '@scaffoldr/errors';
import { layerManifestSchema, moduleManifestSchema } from '@scaffoldr/schema';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { readManifest } from './manifest.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'scaffoldr-manifest-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function fileWith(name: string, content: string): Promise<string> {
  const file = path.join(dir, name);
  await writeFile(file, content);
  return file;
}

async function errorFrom(promise: Promise<unknown>): Promise<ScaffoldrError> {
  const error = await promise.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ScaffoldrError);
  return error as ScaffoldrError;
}

const validLayer = {
  id: 'next-app',
  name: 'Next.js (App Router)',
  engines: { node: '>=20', scaffoldr: '^0.1.0' },
  injectionPoints: ['providers'],
};

describe('readManifest', () => {
  test('returns the parsed value for a valid file', async () => {
    const file = await fileWith('layer.json', JSON.stringify(validLayer));

    expect(await readManifest(file, layerManifestSchema)).toEqual(validLayer);
  });

  test('returns the schema defaults filled in', async () => {
    const file = await fileWith(
      'module.json',
      JSON.stringify({
        id: 'db-prisma',
        name: 'Prisma',
        version: '0.1.0',
        supports: {},
      }),
    );

    const manifest = await readManifest(file, moduleManifestSchema);

    expect(manifest.files).toEqual([]);
    expect(manifest.supports.layers).toEqual([]);
  });

  test('accepts a file that starts with a byte order mark', async () => {
    const file = await fileWith(
      'layer.json',
      `\uFEFF${JSON.stringify(validLayer)}`,
    );

    expect((await readManifest(file, layerManifestSchema)).id).toBe('next-app');
  });

  test('throws INVALID_CONFIG for invalid JSON and names the file', async () => {
    const file = await fileWith('broken.json', '{ "id": "next-app", }');

    const error = await errorFrom(readManifest(file, layerManifestSchema));

    expect(error.code).toBe('INVALID_CONFIG');
    expect(error.message).toContain(file);
    expect(error.message).toContain('not valid JSON');
    expect(error.details?.file).toBe(file);
    expect(error.hint).toBeTruthy();
  });

  test('treats an empty file as invalid JSON', async () => {
    const file = await fileWith('empty.json', '');

    const error = await errorFrom(readManifest(file, layerManifestSchema));

    expect(error.code).toBe('INVALID_CONFIG');
    expect(error.message).toContain('not valid JSON');
  });

  test('throws INVALID_CONFIG for a schema failure and lists every issue with its field path', async () => {
    const file = await fileWith(
      'layer.json',
      JSON.stringify({
        ...validLayer,
        id: 'Bad_ID',
        engines: { scaffoldr: '^0.1.0' },
      }),
    );

    const error = await errorFrom(readManifest(file, layerManifestSchema));

    expect(error.code).toBe('INVALID_CONFIG');
    expect(error.message).toContain(file);
    expect(error.message).toContain('  - id: ');
    expect(error.message).toContain('  - engines.node: ');
    expect(error.details?.file).toBe(file);
    expect(error.details?.issues).toEqual([
      { path: 'id', message: expect.any(String) },
      { path: 'engines.node', message: expect.any(String) },
    ]);
  });

  test('reports a wrong top-level type as (root)', async () => {
    const file = await fileWith('list.json', '[1, 2, 3]');

    const error = await errorFrom(readManifest(file, layerManifestSchema));

    expect(error.message).toContain('  - (root): ');
  });

  test('throws INVALID_CONFIG when the file does not exist', async () => {
    const file = path.join(dir, 'missing.json');

    const error = await errorFrom(readManifest(file, layerManifestSchema));

    expect(error.code).toBe('INVALID_CONFIG');
    expect(error.message).toContain(file);
    expect(error.message).toContain('ENOENT');
  });
});
