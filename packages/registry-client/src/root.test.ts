import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { ScaffoldrError } from '@scaffoldr/errors';
import { getRegistryRoot } from './root.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'scaffoldr-root-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function folder(...parts: string[]): Promise<string> {
  const dir = path.join(root, ...parts);
  await mkdir(dir, { recursive: true });
  return dir;
}

/** A fake monorepo: <root>/repo with a workspace file and a registry/ folder. */
async function fakeRepo(): Promise<{ moduleDir: string; registry: string }> {
  const repo = await folder('repo');
  await writeFile(
    path.join(repo, 'pnpm-workspace.yaml'),
    "packages:\n  - 'packages/*'\n",
  );
  const registry = await folder('repo', 'registry');
  const moduleDir = await folder('repo', 'packages', 'registry-client', 'src');
  return { moduleDir, registry };
}

/** A fake published package: <root>/pkg/dist next to <root>/pkg/registry. */
async function fakePublished(): Promise<{
  moduleDir: string;
  registry: string;
}> {
  const registry = await folder('pkg', 'registry');
  const moduleDir = await folder('pkg', 'dist');
  return { moduleDir, registry };
}

function thrownBy(run: () => unknown): ScaffoldrError {
  try {
    run();
  } catch (error) {
    return error as ScaffoldrError;
  }
  throw new Error('Expected the call to throw');
}

describe('getRegistryRoot: overrides', () => {
  test('returns the override when it exists', async () => {
    const custom = await folder('custom-registry');

    expect(getRegistryRoot(custom, { env: {} })).toBe(custom);
  });

  test('the SCAFFOLDR_REGISTRY environment variable is used without an override', async () => {
    const fromEnv = await folder('env-registry');

    expect(
      getRegistryRoot(undefined, { env: { SCAFFOLDR_REGISTRY: fromEnv } }),
    ).toBe(fromEnv);
  });

  test('the override wins over the environment variable', async () => {
    const custom = await folder('custom-registry');
    const fromEnv = await folder('env-registry');

    expect(
      getRegistryRoot(custom, { env: { SCAFFOLDR_REGISTRY: fromEnv } }),
    ).toBe(custom);
  });

  test('a relative override is resolved to an absolute path', async () => {
    const custom = await folder('custom-registry');
    const relative = path.relative(process.cwd(), custom);

    expect(getRegistryRoot(relative, { env: {} })).toBe(custom);
  });

  test('an empty override or environment variable counts as not set', async () => {
    const { moduleDir, registry } = await fakeRepo();

    expect(
      getRegistryRoot('', { env: { SCAFFOLDR_REGISTRY: '' }, moduleDir }),
    ).toBe(registry);
  });
});

describe('getRegistryRoot: missing paths', () => {
  test('throws INVALID_CONFIG when the override does not exist', () => {
    const missingPath = path.join(root, 'nope');
    const error = thrownBy(() => getRegistryRoot(missingPath, { env: {} }));

    expect(error).toBeInstanceOf(ScaffoldrError);
    expect(error.code).toBe('INVALID_CONFIG');
    expect(error.details).toEqual({
      source: 'the registry option',
      path: missingPath,
    });
    expect(error.hint).toContain('SCAFFOLDR_REGISTRY');
  });

  test('throws when the environment variable points at a missing path, without falling through', async () => {
    const { moduleDir } = await fakeRepo();
    const missingPath = path.join(root, 'nope');
    const error = thrownBy(() =>
      getRegistryRoot(undefined, {
        env: { SCAFFOLDR_REGISTRY: missingPath },
        moduleDir,
      }),
    );

    expect(error.code).toBe('INVALID_CONFIG');
    expect(error.details).toEqual({
      source: 'SCAFFOLDR_REGISTRY',
      path: missingPath,
    });
  });

  test('throws when the override is a file, not a folder', async () => {
    const file = path.join(root, 'a-file');
    await writeFile(file, 'x');

    expect(thrownBy(() => getRegistryRoot(file, { env: {} })).code).toBe(
      'INVALID_CONFIG',
    );
  });

  test('throws when neither the repo registry nor a bundled one exists', async () => {
    const moduleDir = await folder('lonely', 'dist');
    const error = thrownBy(() =>
      getRegistryRoot(undefined, { env: {}, moduleDir }),
    );

    expect(error.code).toBe('INVALID_CONFIG');
    expect(error.message).toContain('Could not find');
    expect(error.hint).toContain('--registry');
  });
});

describe('getRegistryRoot: dev and published layouts', () => {
  test('finds the repo registry folder when running from the monorepo', async () => {
    const { moduleDir, registry } = await fakeRepo();

    expect(getRegistryRoot(undefined, { env: {}, moduleDir })).toBe(registry);
  });

  test('finds the bundled registry folder in a published package', async () => {
    const { moduleDir, registry } = await fakePublished();

    expect(getRegistryRoot(undefined, { env: {}, moduleDir })).toBe(registry);
  });

  test('prefers the repo registry over a bundled one when both exist', async () => {
    const dev = await fakeRepo();
    await folder('repo', 'packages', 'registry', 'x');

    expect(
      getRegistryRoot(undefined, { env: {}, moduleDir: dev.moduleDir }),
    ).toBe(dev.registry);
  });

  test('ignores a folder called registry when there is no workspace file next to it', async () => {
    await folder('project', 'registry');
    const moduleDir = await folder(
      'project',
      'node_modules',
      'scaffoldr',
      'dist',
    );
    const error = thrownBy(() =>
      getRegistryRoot(undefined, { env: {}, moduleDir }),
    );

    expect(error.code).toBe('INVALID_CONFIG');
  });

  test('finds the real registry folder when run from this repo', () => {
    const found = getRegistryRoot(undefined, { env: {} });

    expect(path.basename(found)).toBe('registry');
  });
});
