import { z } from 'zod';
import { relativePathSchema } from './primitives.js';

/** How a file is written when another module may touch the same path. */
export const fileStrategySchema = z.enum([
  'overwrite',
  'json-merge',
  'env-merge',
  'inject',
  'ast-patch',
  'append',
  'prisma-merge',
]);

/** Which logical output root a file is written to. */
export const fileTargetSchema = z.enum(['app', 'shared']);

/** One file a layer or module contributes: where it comes from and how it lands. */
export const fileEntrySchema = z.strictObject({
  from: relativePathSchema,
  to: relativePathSchema,
  strategy: fileStrategySchema.default('overwrite'),
  target: fileTargetSchema.default('app'),
});

export type FileStrategy = z.infer<typeof fileStrategySchema>;
export type FileTarget = z.infer<typeof fileTargetSchema>;
export type FileEntry = z.infer<typeof fileEntrySchema>;