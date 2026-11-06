import { z } from 'zod';
import { idSchema, relativePathSchema, semverSchema } from './primitives.js';

/** One layer, blueprint or module listed in the registry index. */
const registryEntrySchema = z.strictObject({
  id: idSchema,
  name: z.string().min(1),
  version: semverSchema.optional(),
  description: z.string().optional(),
  path: relativePathSchema,
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/, 'Expected a lowercase hex SHA-256 digest')
    .optional(),
});

/** The shape of the registry's generated `index.json`. */
export const registryIndexSchema = z.strictObject({
  registryVersion: semverSchema,
  layers: z.array(registryEntrySchema),
  blueprints: z.array(registryEntrySchema),
  modules: z.array(registryEntrySchema),
});

export type RegistryEntry = z.infer<typeof registryEntrySchema>;
export type RegistryIndex = z.infer<typeof registryIndexSchema>;