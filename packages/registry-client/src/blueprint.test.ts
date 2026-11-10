import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ScaffoldrError } from '@scaffoldr/errors';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { loadBlueprint } from './blueprint.js';

let registryRoot: string;

beforeEach(async () => {
  registryRoot = await mkdtemp(path.join(tmpdir(), 'scaffoldr-registry-'));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(registryRoot, { recursive: true, force: true });
});

// The blueprint.json example from architecture section 5.2.
const ticketing = {
  $schema: 'https://scaffoldr.dev/schema/blueprint.json',
  id: 'ticketing',
  name: 'Event Ticketing',
  description: 'Sell tickets, issue QR codes, check guests in.',
  layer: 'next-app',
  defaults: ['ui-shadcn', 'auth-better-auth', 'tickets-qr', 'seo-basics'],
  slots: {
    db: {
      required: true,
      options: ['db-prisma', 'db-drizzle'],
      default: 'db-prisma',
    },
    payments: {
      required: true,
      options: [
        'payments-paystack',
        'payments-flutterwave',
        'payments-monnify',
      ],
      default: 'payments-paystack',
    },
    email: { required: false, options: ['email-resend'] },
    sms: { required: false, options: ['sms-termii'] },
  },
  questions: [
    {
      id: 'eventName',
      type: 'text',
      message: 'Event name?',
      flag: '--event-name',
    },
    {
      id: 'currency',
      type: 'select',
      options: ['NGN', 'GHS', 'KES', 'USD'],
      default: 'NGN',
      flag: '--currency',
    },
  ],
};

function blueprintJson(
  id: string,
  extra: Record<string, unknown> = {},
): string {
  return JSON.stringify({ ...ticketing, id, ...extra });
}

async function addBlueprint(folder: string, json: string): Promise<string> {
  const dir = path.join(registryRoot, 'blueprints', folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'blueprint.json'), json);
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

describe('loadBlueprint', () => {
  test('returns the manifest and the blueprint folder from a fixture registry', async () => {
    const dir = await addBlueprint('ticketing', blueprintJson('ticketing'));
    await addBlueprint('docs', blueprintJson('docs'));

    const blueprint = await loadBlueprint('ticketing', { registryRoot });

    expect(blueprint.dir).toBe(dir);
    expect(blueprint.manifest.id).toBe('ticketing');
    expect(blueprint.manifest.layer).toBe('next-app');
    expect(blueprint.manifest.slots.db?.default).toBe('db-prisma');
    expect(blueprint.manifest.questions).toHaveLength(2);
  });

  test('throws UNKNOWN_BLUEPRINT for an unknown id and lists the available blueprints', async () => {
    await addBlueprint('ticketing', blueprintJson('ticketing'));
    await addBlueprint('docs', blueprintJson('docs'));

    const error = await errorFrom(loadBlueprint('ecommerce', { registryRoot }));

    expect(error.code).toBe('UNKNOWN_BLUEPRINT');
    expect(error.message).toContain('"ecommerce"');
    expect(error.hint).toBeTruthy();
    expect(error.details).toEqual({
      id: 'ecommerce',
      available: ['docs', 'ticketing'],
    });
  });

  test('throws UNKNOWN_BLUEPRINT when the registry has no blueprints folder at all', async () => {
    const error = await errorFrom(loadBlueprint('ticketing', { registryRoot }));

    expect(error.code).toBe('UNKNOWN_BLUEPRINT');
    expect(error.details).toEqual({ id: 'ticketing', available: [] });
  });

  test('does not mistake a layer for a blueprint', async () => {
    await mkdir(path.join(registryRoot, 'layers', 'next-app'), {
      recursive: true,
    });

    const error = await errorFrom(loadBlueprint('next-app', { registryRoot }));

    expect(error.code).toBe('UNKNOWN_BLUEPRINT');
  });

  test.each(['../outside', 'Bad_ID', '', 'a/b', '/etc'])(
    'throws UNKNOWN_BLUEPRINT for the invalid id %j and never reads outside blueprints/',
    async (badId) => {
      await mkdir(path.join(registryRoot, 'outside'), { recursive: true });
      await writeFile(
        path.join(registryRoot, 'outside', 'blueprint.json'),
        blueprintJson('outside'),
      );

      const error = await errorFrom(loadBlueprint(badId, { registryRoot }));

      expect(error.code).toBe('UNKNOWN_BLUEPRINT');
    },
  );

  test('throws INVALID_CONFIG when blueprint.json does not match the schema', async () => {
    await addBlueprint(
      'ticketing',
      blueprintJson('ticketing', { layer: undefined }),
    );

    const error = await errorFrom(loadBlueprint('ticketing', { registryRoot }));

    expect(error.code).toBe('INVALID_CONFIG');
    expect(error.message).toContain('  - layer: ');
  });

  test('throws INVALID_CONFIG when the blueprint folder has no blueprint.json', async () => {
    await mkdir(path.join(registryRoot, 'blueprints', 'empty-one'), {
      recursive: true,
    });

    const error = await errorFrom(loadBlueprint('empty-one', { registryRoot }));

    expect(error.code).toBe('INVALID_CONFIG');
    expect(error.message).toContain('blueprint.json');
  });

  test('throws INVALID_CONFIG when the manifest id differs from the folder name', async () => {
    await addBlueprint('ticketing', blueprintJson('docs'));

    const error = await errorFrom(loadBlueprint('ticketing', { registryRoot }));

    expect(error.code).toBe('INVALID_CONFIG');
    expect(error.details).toMatchObject({
      expected: 'ticketing',
      actual: 'docs',
    });
  });

  test('uses SCAFFOLDR_REGISTRY when no registryRoot is given', async () => {
    const dir = await addBlueprint('ticketing', blueprintJson('ticketing'));
    vi.stubEnv('SCAFFOLDR_REGISTRY', registryRoot);

    const blueprint = await loadBlueprint('ticketing');

    expect(blueprint.dir).toBe(dir);
  });
});
