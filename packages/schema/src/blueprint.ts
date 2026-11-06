import { z } from 'zod';
import { idSchema } from './primitives.js';

const nonEmptyString = z.string().min(1);

/** When both are present, `default` has to be one of `options`. */
function defaultIsInOptions(value: { options?: string[]; default?: unknown }): boolean {
  if (value.options === undefined || value.default === undefined) {
    return true;
  }
  return typeof value.default === 'string' && value.options.includes(value.default);
}

const defaultInOptionsIssue = {
  message: 'default must be one of options',
  path: ['default'],
};

const slotSchema = z
  .strictObject({
    required: z.boolean(),
    options: z.array(idSchema).min(1),
    default: idSchema.optional(),
  })
  .refine(defaultIsInOptions, defaultInOptionsIssue);

const questionSchema = z
  .strictObject({
    id: nonEmptyString,
    type: z.enum(['text', 'select', 'confirm']),
    message: nonEmptyString.optional(),
    options: z.array(nonEmptyString).optional(),
    default: z.union([z.string(), z.boolean()]).optional(),
    flag: z.string().regex(/^--[a-z][a-z0-9-]*$/, 'Expected a flag such as --event-name'),
  })
  .refine(defaultIsInOptions, defaultInOptionsIssue);

/** The shape of a blueprint's `blueprint.json`: a product type built from a layer and modules. */
export const blueprintManifestSchema = z.strictObject({
  $schema: z.string().optional(),
  id: idSchema,
  name: nonEmptyString,
  description: nonEmptyString,
  layer: idSchema,
  defaults: z.array(idSchema),
  slots: z.record(idSchema, slotSchema),
  questions: z.array(questionSchema),
});

export type BlueprintManifest = z.infer<typeof blueprintManifestSchema>;