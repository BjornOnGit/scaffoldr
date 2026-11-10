import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ScaffoldrError } from '@scaffoldr/errors';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { loadModule } from './module.js';

let registryRoot: string;

beforeEach(async () => {
  registryRoot = await mkdtemp(path.join(tmpdir(), 'scaffoldr-registry-'));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(registryRoot, { recursive: true, force: true });
});

// The module.json example from architecture section 5.3.
const paystack = {
  $schema: 'https://scaffoldr.dev/schema/module.json',
  id: 'payments-paystack',
  name: 'Paystack Payments',
  version: '0.1.0',
  slot: 'payments',
  requires: ['db-*'],
  conflicts: ['payments-flutterwave', 'payments-monnify'],
  supports: { layers: ['next-app'] },
  packageJson: { dependencies: { 'paystack-sdk': '^1.0.0' } },
  env: [
    {
      key: 'PAYSTACK_SECRET_KEY',
      description: 'Secret key from the Paystack dashboard',
      required: true,
    },
    { key: 'PAYSTACK_WEBHOOK_SECRET', required: true },
  ],
  files: [
    {
      from: 'files/lib/paystack.ts.hbs',
      to: 'src/lib/paystack.ts',
      strategy: 'overwrite',
    },
  ],
  inject: [{ point: 'env-schema', from: 'patches/env.inject.ts' }],
  notes: [
    'Add your webhook URL in the Paystack dashboard: /api/paystack/webhook',
  ],
};

function moduleJson(id: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...paystack, id, ...extra });
}

async function addModule(folder: string, json: string): Promise<string> {
  const dir = path.join(registryRoot, 'modules', folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'module.json'), json);
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

describe('loadModule', () => {
  test('returns the manifest and the module folder from a fixture registry', async () => {
    const dir = await addModule(
      'payments-paystack',
      moduleJson('payments-paystack'),
    );
    await addModule('db-prisma', moduleJson('db-prisma', { slot: 'db' }));

    const loaded = await loadModule('payments-paystack', { registryRoot });

    expect(loaded.dir).toBe(dir);
    expect(loaded.manifest.id).toBe('payments-paystack');
    expect(loaded.manifest.slot).toBe('payments');
    expect(loaded.manifest.supports.layers).toEqual(['next-app']);
    expect(loaded.manifest.files[0]).toEqual({
      from: 'files/lib/paystack.ts.hbs',
      to: 'src/lib/paystack.ts',
      strategy: 'overwrite',
      target: 'app',
    });
  });

  test('fills in defaults for a minimal manifest', async () => {
    await addModule(
      'db-prisma',
      JSON.stringify({
        id: 'db-prisma',
        name: 'Prisma',
        version: '0.1.0',
        supports: {},
      }),
    );

    const { manifest } = await loadModule('db-prisma', { registryRoot });

    expect(manifest.requires).toEqual([]);
    expect(manifest.files).toEqual([]);
    expect(manifest.notes).toEqual([]);
  });

  test('throws UNKNOWN_MODULE for an unknown id and lists the available modules', async () => {
    await addModule('payments-paystack', moduleJson('payments-paystack'));
    await addModule('db-prisma', moduleJson('db-prisma'));

    const error = await errorFrom(
      loadModule('payments-stripe', { registryRoot }),
    );

    expect(error.code).toBe('UNKNOWN_MODULE');
    expect(error.message).toContain('"payments-stripe"');
    expect(error.hint).toBeTruthy();
    expect(error.details).toEqual({
      id: 'payments-stripe',
      available: ['db-prisma', 'payments-paystack'],
    });
  });

  test('throws UNKNOWN_MODULE when the registry has no modules folder at all', async () => {
    const error = await errorFrom(loadModule('db-prisma', { registryRoot }));

    expect(error.code).toBe('UNKNOWN_MODULE');
    expect(error.details).toEqual({ id: 'db-prisma', available: [] });
  });

  test('does not mistake a layer or blueprint for a module', async () => {
    await mkdir(path.join(registryRoot, 'layers', 'next-app'), {
      recursive: true,
    });
    await mkdir(path.join(registryRoot, 'blueprints', 'ticketing'), {
      recursive: true,
    });

    for (const id of ['next-app', 'ticketing']) {
      const error = await errorFrom(loadModule(id, { registryRoot }));
      expect(error.code).toBe('UNKNOWN_MODULE');
    }
  });

  test.each(['../outside', 'Bad_ID', '', 'a/b', '/etc'])(
    'throws UNKNOWN_MODULE for the invalid id %j and never reads outside modules/',
    async (badId) => {
      await mkdir(path.join(registryRoot, 'outside'), { recursive: true });
      await writeFile(
        path.join(registryRoot, 'outside', 'module.json'),
        moduleJson('outside'),
      );

      const error = await errorFrom(loadModule(badId, { registryRoot }));

      expect(error.code).toBe('UNKNOWN_MODULE');
    },
  );

  test('throws INVALID_CONFIG when module.json does not match the schema', async () => {
    await addModule(
      'payments-paystack',
      moduleJson('payments-paystack', { version: '1.0' }),
    );

    const error = await errorFrom(
      loadModule('payments-paystack', { registryRoot }),
    );

    expect(error.code).toBe('INVALID_CONFIG');
    expect(error.message).toContain('  - version: ');
  });

  test('throws INVALID_CONFIG when the module folder has no module.json', async () => {
    await mkdir(path.join(registryRoot, 'modules', 'empty-one'), {
      recursive: true,
    });

    const error = await errorFrom(loadModule('empty-one', { registryRoot }));

    expect(error.code).toBe('INVALID_CONFIG');
    expect(error.message).toContain('module.json');
  });

  test('throws INVALID_CONFIG when the manifest id differs from the folder name', async () => {
    await addModule('payments-paystack', moduleJson('db-prisma'));

    const error = await errorFrom(
      loadModule('payments-paystack', { registryRoot }),
    );

    expect(error.code).toBe('INVALID_CONFIG');
    expect(error.details).toMatchObject({
      expected: 'payments-paystack',
      actual: 'db-prisma',
    });
  });

  test('uses SCAFFOLDR_REGISTRY when no registryRoot is given', async () => {
    const dir = await addModule(
      'payments-paystack',
      moduleJson('payments-paystack'),
    );
    vi.stubEnv('SCAFFOLDR_REGISTRY', registryRoot);

    const loaded = await loadModule('payments-paystack');

    expect(loaded.dir).toBe(dir);
  });
});
