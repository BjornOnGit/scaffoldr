import { execFile } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { registryIndexSchema } from '@scaffoldr/schema';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  buildIndex,
  formatIndex,
  formatReport,
  main,
  resolveRegistryVersion,
  validateRegistry,
} from './build-registry.js';

const run = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL('./build-registry.ts', import.meta.url),
);
const realRegistry = path.resolve(path.dirname(scriptPath), '..', 'registry');

let registry: string;

beforeEach(async () => {
  registry = await mkdtemp(path.join(tmpdir(), 'scaffoldr-build-registry-'));
});

afterEach(async () => {
  await rm(registry, { recursive: true, force: true });
});

async function add(
  kind: string,
  folder: string,
  fileName: string,
  json: string,
): Promise<void> {
  const dir = path.join(registry, kind, folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), json);
}

const layer = (id: string) =>
  JSON.stringify({
    id,
    name: id,
    engines: { node: '>=20', scaffoldr: '^0.1.0' },
    injectionPoints: [],
  });

const blueprint = (id: string) =>
  JSON.stringify({
    id,
    name: id,
    description: id,
    layer: 'next-app',
    defaults: [],
    slots: {},
    questions: [],
  });

const mod = (id: string, version = '0.1.0') =>
  JSON.stringify({ id, name: id, version, supports: {} });

describe('validateRegistry', () => {
  test('is green for an empty registry', async () => {
    for (const kind of ['layers', 'blueprints', 'modules']) {
      await mkdir(path.join(registry, kind));
    }

    const report = await validateRegistry(registry);

    expect(report).toEqual({
      counts: { layers: 0, blueprints: 0, modules: 0 },
      problems: [],
    });
  });

  test('is green when the kind folders do not exist at all', async () => {
    expect((await validateRegistry(registry)).problems).toEqual([]);
  });

  test("is green for this repo's real registry/ folder", async () => {
    expect((await validateRegistry(realRegistry)).problems).toEqual([]);
  });

  test('counts every valid manifest', async () => {
    await add('layers', 'next-app', 'layer.json', layer('next-app'));
    await add(
      'blueprints',
      'ticketing',
      'blueprint.json',
      blueprint('ticketing'),
    );
    await add('modules', 'db-prisma', 'module.json', mod('db-prisma'));
    await add('modules', 'email-resend', 'module.json', mod('email-resend'));

    const report = await validateRegistry(registry);

    expect(report.counts).toEqual({ layers: 1, blueprints: 1, modules: 2 });
    expect(report.problems).toEqual([]);
  });

  test('fails on a fixture with an invalid manifest, naming the file and the field', async () => {
    await add('modules', 'db-prisma', 'module.json', mod('db-prisma'));
    await add('modules', 'broken-one', 'module.json', mod('broken-one', '1.0'));

    const report = await validateRegistry(registry);

    expect(report.counts.modules).toBe(1);
    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]?.path).toBe('modules/broken-one');
    expect(report.problems[0]?.message).toContain(
      path.join('broken-one', 'module.json'),
    );
    expect(report.problems[0]?.message).toContain('  - version: ');
  });

  test('reports every problem, not only the first', async () => {
    await add('layers', 'bad-layer', 'layer.json', '{ not json');
    await add(
      'modules',
      'bad-module',
      'module.json',
      mod('bad-module', 'nope'),
    );
    await add('blueprints', 'bad-blueprint', 'blueprint.json', '{}');

    const report = await validateRegistry(registry);

    expect(report.problems.map((problem) => problem.path)).toEqual([
      'layers/bad-layer',
      'blueprints/bad-blueprint',
      'modules/bad-module',
    ]);
  });

  test('flags a folder whose name is not a valid id', async () => {
    await mkdir(path.join(registry, 'modules', 'Not_An_Id'), {
      recursive: true,
    });

    const report = await validateRegistry(registry);

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]?.path).toBe('modules/Not_An_Id');
    expect(report.problems[0]?.message).toContain('not a valid id');
  });

  test('flags a manifest whose id differs from its folder name', async () => {
    await add('modules', 'db-prisma', 'module.json', mod('something-else'));

    const report = await validateRegistry(registry);

    expect(report.problems[0]?.message).toContain(
      'declares the id "something-else"',
    );
  });

  test('flags a folder with no manifest file', async () => {
    await mkdir(path.join(registry, 'layers', 'empty-layer'), {
      recursive: true,
    });

    expect((await validateRegistry(registry)).problems[0]?.path).toBe(
      'layers/empty-layer',
    );
  });

  test('ignores loose files inside a kind folder', async () => {
    await mkdir(path.join(registry, 'modules'));
    await writeFile(path.join(registry, 'modules', 'README.md'), 'notes');

    expect((await validateRegistry(registry)).problems).toEqual([]);
  });

  test('reports a registry folder that does not exist', async () => {
    const report = await validateRegistry(path.join(registry, 'nope'));

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]?.message).toContain('does not exist');
  });
});

describe('formatReport', () => {
  test('prints a summary when everything is valid', () => {
    const text = formatReport('/r', {
      counts: { layers: 1, blueprints: 2, modules: 3 },
      problems: [],
    });

    expect(text).toContain('layers:     1');
    expect(text).toContain('blueprints: 2');
    expect(text).toContain('modules:    3');
    expect(text).toContain('Registry OK: 6 manifests valid.');
  });

  test('lists each problem with its path and counts them', () => {
    const text = formatReport('/r', {
      counts: { layers: 0, blueprints: 0, modules: 0 },
      problems: [
        { path: 'modules/a-one', message: 'first problem' },
        { path: 'layers/b-two', message: 'second problem' },
      ],
    });

    expect(text).toContain('FAIL modules/a-one\nfirst problem');
    expect(text).toContain('FAIL layers/b-two\nsecond problem');
    expect(text).toContain('Registry has 2 problems.');
  });
});

async function addFixtureContent(): Promise<void> {
  await add('layers', 'vite-react', 'layer.json', layer('vite-react'));
  await add('layers', 'next-app', 'layer.json', layer('next-app'));
  await add(
    'blueprints',
    'ticketing',
    'blueprint.json',
    blueprint('ticketing'),
  );
  await add(
    'modules',
    'payments-paystack',
    'module.json',
    mod('payments-paystack', '0.2.0'),
  );
  await add('modules', 'db-prisma', 'module.json', mod('db-prisma'));
}

describe('resolveRegistryVersion', () => {
  test('uses REGISTRY_VERSION when it is set', () => {
    expect(
      resolveRegistryVersion({ REGISTRY_VERSION: '2026.11.0' }, new Date()),
    ).toBe('2026.11.0');
  });

  test("falls back to today's UTC date as YYYY.M.D", () => {
    const now = new Date(Date.UTC(2026, 10, 10, 15, 30));

    expect(resolveRegistryVersion({}, now)).toBe('2026.11.10');
  });

  test('has no leading zeros, so it is valid semver', () => {
    const now = new Date(Date.UTC(2026, 0, 5, 0, 0));

    expect(resolveRegistryVersion({}, now)).toBe('2026.1.5');
  });

  test('uses the UTC date, not the local one', () => {
    const justBeforeMidnightUtc = new Date(Date.UTC(2026, 11, 31, 23, 59));

    expect(resolveRegistryVersion({}, justBeforeMidnightUtc)).toBe(
      '2026.12.31',
    );
  });

  test('treats an empty REGISTRY_VERSION as not set', () => {
    const now = new Date(Date.UTC(2026, 10, 10));

    expect(resolveRegistryVersion({ REGISTRY_VERSION: '' }, now)).toBe(
      '2026.11.10',
    );
  });

  test('rejects a REGISTRY_VERSION that is not a version', () => {
    expect(() =>
      resolveRegistryVersion({ REGISTRY_VERSION: 'tuesday' }, new Date()),
    ).toThrow(/not a valid version/);
  });
});

describe('buildIndex', () => {
  test('lists every layer, blueprint and module sorted by id, and passes the index schema', async () => {
    await addFixtureContent();

    const index = await buildIndex(registry, '2026.11.10');

    expect(registryIndexSchema.safeParse(index).success).toBe(true);
    expect(index).toEqual({
      registryVersion: '2026.11.10',
      layers: [
        { id: 'next-app', name: 'next-app', path: 'layers/next-app' },
        { id: 'vite-react', name: 'vite-react', path: 'layers/vite-react' },
      ],
      blueprints: [
        {
          id: 'ticketing',
          name: 'ticketing',
          description: 'ticketing',
          path: 'blueprints/ticketing',
        },
      ],
      modules: [
        {
          id: 'db-prisma',
          name: 'db-prisma',
          version: '0.1.0',
          path: 'modules/db-prisma',
        },
        {
          id: 'payments-paystack',
          name: 'payments-paystack',
          version: '0.2.0',
          path: 'modules/payments-paystack',
        },
      ],
    });
  });

  test('is valid for an empty registry', async () => {
    const index = await buildIndex(registry, '2026.11.10');

    expect(index).toEqual({
      registryVersion: '2026.11.10',
      layers: [],
      blueprints: [],
      modules: [],
    });
  });
});

describe('formatIndex', () => {
  test('uses two-space indent and ends with a newline', async () => {
    const text = formatIndex(await buildIndex(registry, '2026.11.10'));

    expect(text.startsWith('{\n  "registryVersion": "2026.11.10",\n')).toBe(
      true,
    );
    expect(text.endsWith('}\n')).toBe(true);
  });
});

describe('main writes index.json', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  function silence(): void {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  }

  test('produces a valid index.json', async () => {
    silence();
    await addFixtureContent();

    await main(registry, { env: { REGISTRY_VERSION: '2026.11.10' } });

    const written = JSON.parse(
      await readFile(path.join(registry, 'index.json'), 'utf8'),
    );
    expect(registryIndexSchema.safeParse(written).success).toBe(true);
    expect(written.registryVersion).toBe('2026.11.10');
    expect(written.modules.map((entry: { id: string }) => entry.id)).toEqual([
      'db-prisma',
      'payments-paystack',
    ]);
    expect(process.exitCode).toBeUndefined();
  });

  test('running twice with the version fixed gives byte-identical output', async () => {
    silence();
    await addFixtureContent();
    const env = { REGISTRY_VERSION: '2026.11.10' };

    await main(registry, { env });
    const first = await readFile(path.join(registry, 'index.json'), 'utf8');
    await main(registry, { env, now: new Date(Date.UTC(2030, 0, 1)) });
    const second = await readFile(path.join(registry, 'index.json'), 'utf8');

    expect(second).toBe(first);
  });

  test("uses today's date when REGISTRY_VERSION is not set", async () => {
    silence();

    await main(registry, { env: {}, now: new Date(Date.UTC(2026, 10, 10)) });

    const written = JSON.parse(
      await readFile(path.join(registry, 'index.json'), 'utf8'),
    );
    expect(written.registryVersion).toBe('2026.11.10');
  });

  test('an existing index.json is not mistaken for content and gets replaced', async () => {
    silence();
    await addFixtureContent();
    await writeFile(path.join(registry, 'index.json'), '{"old":true}');

    await main(registry, { env: { REGISTRY_VERSION: '2026.11.10' } });

    const written = JSON.parse(
      await readFile(path.join(registry, 'index.json'), 'utf8'),
    );
    expect(written.old).toBeUndefined();
    expect(written.layers).toHaveLength(2);
  });

  test('writes nothing and fails when a manifest is invalid', async () => {
    silence();
    await add('modules', 'broken-one', 'module.json', mod('broken-one', '1.0'));

    await main(registry, { env: { REGISTRY_VERSION: '2026.11.10' } });

    expect(process.exitCode).toBe(1);
    await expect(stat(path.join(registry, 'index.json'))).rejects.toThrow();
  });

  test('fails without writing when REGISTRY_VERSION is invalid', async () => {
    silence();
    await addFixtureContent();

    await main(registry, { env: { REGISTRY_VERSION: 'tuesday' } });

    expect(process.exitCode).toBe(1);
    await expect(stat(path.join(registry, 'index.json'))).rejects.toThrow();
  });
});

// Running a .ts file directly needs Node's built-in type stripping (Node 22.18 or newer).
const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
const canRunTypeScript = major > 22 || (major === 22 && minor >= 18);

describe.skipIf(!canRunTypeScript)(
  'the script run from the command line',
  () => {
    async function runScript(dir: string) {
      return run(process.execPath, [scriptPath, dir]).then(
        ({ stdout, stderr }) => ({ code: 0, stdout, stderr }),
        (error: { code: number; stdout: string; stderr: string }) => ({
          code: error.code,
          stdout: error.stdout,
          stderr: error.stderr,
        }),
      );
    }

    test('exits 0 and prints a summary on an empty registry', async () => {
      const result = await runScript(registry);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Registry OK: 0 manifests valid.');
    });

    test('writes the same index.json on two runs with REGISTRY_VERSION fixed', async () => {
      await addFixtureContent();
      const runWithVersion = () =>
        run(process.execPath, [scriptPath, registry], {
          env: { ...process.env, REGISTRY_VERSION: '2026.11.10' },
        });

      await runWithVersion();
      const first = await readFile(path.join(registry, 'index.json'), 'utf8');
      const second = await runWithVersion().then(() =>
        readFile(path.join(registry, 'index.json'), 'utf8'),
      );

      expect(second).toBe(first);
      expect(registryIndexSchema.safeParse(JSON.parse(first)).success).toBe(
        true,
      );
    });

    test('exits 1 and prints the file path for an invalid manifest', async () => {
      await add(
        'modules',
        'broken-one',
        'module.json',
        mod('broken-one', '1.0'),
      );

      const result = await runScript(registry);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('FAIL modules/broken-one');
      expect(result.stderr).toContain(path.join('broken-one', 'module.json'));
    });
  },
);
