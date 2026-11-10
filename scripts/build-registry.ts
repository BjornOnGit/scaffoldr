import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ScaffoldrError } from '@scaffoldr/errors';
import {
  listBlueprints,
  listLayers,
  listModules,
  loadBlueprint,
  loadLayer,
  loadModule,
} from '@scaffoldr/registry-client';
import {
  type RegistryIndex,
  idSchema,
  registryIndexSchema,
  semverSchema,
} from '@scaffoldr/schema';

const kinds = ['layers', 'blueprints', 'modules'] as const;
type Kind = (typeof kinds)[number];

const loaders: Record<
  Kind,
  (id: string, options: { registryRoot: string }) => Promise<unknown>
> = {
  layers: loadLayer,
  blueprints: loadBlueprint,
  modules: loadModule,
};

export interface Problem {
  /** The folder with the problem, relative to the registry, such as `modules/payments-x`. */
  path: string;
  message: string;
}

export interface RegistryReport {
  /** How many manifests of each kind are valid. */
  counts: Record<Kind, number>;
  problems: Problem[];
}

/** Checks every layer, blueprint and module folder and collects every problem, not just the first. */
export async function validateRegistry(
  registryDir: string,
): Promise<RegistryReport> {
  const report: RegistryReport = {
    counts: { layers: 0, blueprints: 0, modules: 0 },
    problems: [],
  };

  let rootEntries: string[];
  try {
    rootEntries = await readdir(registryDir);
  } catch {
    report.problems.push({
      path: '.',
      message: `The registry folder "${registryDir}" does not exist.`,
    });
    return report;
  }

  for (const kind of kinds) {
    if (!rootEntries.includes(kind)) {
      continue;
    }
    const entries = await readdir(path.join(registryDir, kind), {
      withFileTypes: true,
    });
    const folders = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    for (const folder of folders) {
      const folderPath = `${kind}/${folder}`;
      if (!idSchema.safeParse(folder).success) {
        report.problems.push({
          path: folderPath,
          message: `The folder name "${folder}" is not a valid id (lowercase letters, digits and hyphens, 2-60 characters).`,
        });
        continue;
      }
      try {
        await loaders[kind](folder, { registryRoot: registryDir });
        report.counts[kind] += 1;
      } catch (error) {
        const message =
          error instanceof ScaffoldrError || error instanceof Error
            ? error.message
            : String(error);
        report.problems.push({ path: folderPath, message });
      }
    }
  }
  return report;
}

/** The text the script prints: a summary when all is well, the problems when not. */
export function formatReport(
  registryDir: string,
  report: RegistryReport,
): string {
  const { layers, blueprints, modules } = report.counts;
  const total = layers + blueprints + modules;
  const lines = [
    `Validated registry at ${registryDir}`,
    `  layers:     ${layers}`,
    `  blueprints: ${blueprints}`,
    `  modules:    ${modules}`,
  ];
  if (report.problems.length === 0) {
    lines.push(
      `Registry OK: ${total} manifest${total === 1 ? '' : 's'} valid.`,
    );
  } else {
    for (const problem of report.problems) {
      lines.push('', `FAIL ${problem.path}`, problem.message);
    }
    const count = report.problems.length;
    lines.push('', `Registry has ${count} problem${count === 1 ? '' : 's'}.`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * The registry's calendar version. `REGISTRY_VERSION` wins when it is set; otherwise it is
 * today's UTC date as `YYYY.M.D`, such as `2026.11.10` (semver allows no leading zeros).
 */
export function resolveRegistryVersion(
  env: Record<string, string | undefined>,
  now: Date,
): string {
  const fromEnv = env.REGISTRY_VERSION;
  if (fromEnv !== undefined && fromEnv !== '') {
    if (!semverSchema.safeParse(fromEnv).success) {
      throw new ScaffoldrError(
        'INVALID_CONFIG',
        `REGISTRY_VERSION "${fromEnv}" is not a valid version.`,
        { hint: 'Use a calendar version such as 2026.11.10.' },
      );
    }
    return fromEnv;
  }
  return `${now.getUTCFullYear()}.${now.getUTCMonth() + 1}.${now.getUTCDate()}`;
}

/** Builds the content of `index.json` from the manifests. The registry must already be valid. */
export async function buildIndex(
  registryDir: string,
  registryVersion: string,
): Promise<RegistryIndex> {
  const options = { registryRoot: registryDir };
  const [layers, blueprints, modules] = await Promise.all([
    listLayers(options),
    listBlueprints(options),
    listModules(options),
  ]);

  return registryIndexSchema.parse({
    registryVersion,
    layers: layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      path: `layers/${layer.id}`,
    })),
    blueprints: blueprints.map((blueprint) => ({
      id: blueprint.id,
      name: blueprint.name,
      description: blueprint.description,
      path: `blueprints/${blueprint.id}`,
    })),
    modules: modules.map((module) => ({
      id: module.id,
      name: module.name,
      version: module.version,
      path: `modules/${module.id}`,
    })),
  });
}

/** The exact text written to `index.json`: stable key order, two-space indent, final newline. */
export function formatIndex(index: RegistryIndex): string {
  return `${JSON.stringify(index, null, 2)}\n`;
}

export interface MainOptions {
  env?: Record<string, string | undefined>;
  now?: Date;
}

/**
 * Validates the registry. When it is valid, also writes `index.json` into it. Sets the exit
 * code: 0 when all went well, 1 when anything failed. Nothing is written after a failure.
 */
export async function main(
  registryDir: string,
  options: MainOptions = {},
): Promise<void> {
  try {
    const report = await validateRegistry(registryDir);
    if (report.problems.length > 0) {
      process.stderr.write(formatReport(registryDir, report));
      process.exitCode = 1;
      return;
    }

    const registryVersion = resolveRegistryVersion(
      options.env ?? process.env,
      options.now ?? new Date(),
    );
    const indexPath = path.join(registryDir, 'index.json');
    await writeFile(
      indexPath,
      formatIndex(await buildIndex(registryDir, registryVersion)),
    );

    process.stdout.write(formatReport(registryDir, report));
    process.stdout.write(
      `Wrote ${indexPath} (registryVersion ${registryVersion}).\n`,
    );
  } catch (error) {
    const hint =
      error instanceof ScaffoldrError && error.hint !== undefined
        ? `\n${error.hint}`
        : '';
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}${hint}\n`,
    );
    process.exitCode = 1;
  }
}

const isEntryPoint =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  const defaultDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'registry',
  );
  await main(path.resolve(process.argv[2] ?? defaultDir));
}
