import { z } from 'zod';
import { fileEntrySchema } from './file-entry.js';
import { layerManifestSchema } from './layer.js';
import { idSchema, relativePathSchema, semverSchema } from './primitives.js';

const nonEmptyString = z.string().min(1);

const envVarSchema = z.strictObject({
  key: z
    .string()
    .regex(
      /^[A-Za-z_][A-Za-z0-9_]*$/,
      'Expected a valid environment variable name',
    ),
  description: z.string().optional(),
  required: z.boolean(),
});

const injectEntrySchema = z.strictObject({
  point: nonEmptyString,
  from: relativePathSchema,
});

/** The shape of a module's `module.json`: one installable feature. */
export const moduleManifestSchema = z.strictObject({
  $schema: z.string().optional(),
  id: idSchema,
  name: nonEmptyString,
  version: semverSchema,
  slot: idSchema.optional(),
  requires: z.array(nonEmptyString).default([]),
  conflicts: z.array(nonEmptyString).default([]),
  supports: z.strictObject({
    layers: z.array(nonEmptyString).default([]),
  }),
  // Same partial package.json shape that layers use.
  packageJson: layerManifestSchema.shape.packageJson,
  env: z.array(envVarSchema).default([]),
  files: z.array(fileEntrySchema).default([]),
  inject: z.array(injectEntrySchema).default([]),
  notes: z.array(nonEmptyString).default([]),
});

export type ModuleManifest = z.infer<typeof moduleManifestSchema>;
