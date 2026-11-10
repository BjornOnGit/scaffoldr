import { z } from 'zod';
import {
  idSchema,
  relativePathSchema,
  semverRangeSchema,
} from './primitives.js';

const dependencyMapSchema = z.record(z.string(), z.string());

/** A partial `package.json`; other standard fields pass through untouched. */
const partialPackageJsonSchema = z.looseObject({
  scripts: dependencyMapSchema.optional(),
  dependencies: dependencyMapSchema.optional(),
  devDependencies: dependencyMapSchema.optional(),
  peerDependencies: dependencyMapSchema.optional(),
});

/** The shape of a layer's `layer.json`: the base framework a project starts from. */
export const layerManifestSchema = z.strictObject({
  $schema: z.string().optional(),
  id: idSchema,
  name: z.string().min(1),
  engines: z.strictObject({
    node: semverRangeSchema,
    scaffoldr: semverRangeSchema,
  }),
  injectionPoints: z.array(z.string().min(1)),
  packageJson: partialPackageJsonSchema.optional(),
  monorepo: z.strictObject({ appDir: relativePathSchema }).optional(),
});

export type LayerManifest = z.infer<typeof layerManifestSchema>;
