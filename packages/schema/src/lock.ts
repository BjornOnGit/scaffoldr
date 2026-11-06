import { z } from 'zod';
import { idSchema, relativePathSchema, semverSchema } from './primitives.js';

const installedModuleSchema = z.strictObject({
  id: idSchema,
  version: semverSchema,
  source: z.enum(['bundled', 'remote']),
});

const ownedFileSchema = z.strictObject({
  /** A module id, or `merged` when several modules contributed to the file. */
  owner: idSchema,
  sha256: z.string().regex(/^[a-f0-9]{64}$/, 'Expected a lowercase hex SHA-256 digest'),
});

/** The shape of a project's `scaffoldr.json`: everything needed to run `add` or `doctor` later. */
export const lockFileSchema = z.strictObject({
  $schema: z.string().optional(),
  scaffoldrVersion: semverSchema,
  registryVersion: semverSchema,
  blueprint: idSchema,
  layer: idSchema,
  answers: z.record(z.string(), z.union([z.string(), z.boolean()])),
  modules: z.array(installedModuleSchema),
  files: z.record(relativePathSchema, ownedFileSchema),
  monorepo: z.boolean().optional(),
});

export type LockFile = z.infer<typeof lockFileSchema>;