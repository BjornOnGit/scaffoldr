/// <reference types="node" />

import { readFile } from 'node:fs/promises';
import { ScaffoldrError } from '@scaffoldr/errors';
import type { z } from 'zod';

function invalidConfig(
  message: string,
  file: string,
  extra: Record<string, unknown> = {},
): ScaffoldrError {
  return new ScaffoldrError('INVALID_CONFIG', message, {
    hint: 'Fix the file named above, then try again.',
    details: { file, ...extra },
  });
}

/**
 * Reads a JSON file and checks it against a zod schema, returning the parsed value
 * (with the schema's defaults filled in).
 *
 * Throws `INVALID_CONFIG`, naming the file, if it cannot be read, is not valid JSON, or does
 * not match the schema. For a schema failure the message lists every issue with its field path.
 */
export async function readManifest<S extends z.ZodType>(
  file: string,
  schema: S,
): Promise<z.output<S>> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    const reason = (error as NodeJS.ErrnoException).code ?? String(error);
    throw invalidConfig(`Could not read "${file}": ${reason}.`, file, {
      reason,
    });
  }

  let json: unknown;
  try {
    // A leading byte order mark is valid in a file but not in JSON text.
    json = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw invalidConfig(`"${file}" is not valid JSON: ${reason}`, file, {
      reason,
    });
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    const lines = issues.map(
      (issue) =>
        `  - ${issue.path === '' ? '(root)' : issue.path}: ${issue.message}`,
    );
    throw invalidConfig(`"${file}" is not valid:\n${lines.join('\n')}`, file, {
      issues,
    });
  }
  return result.data;
}
