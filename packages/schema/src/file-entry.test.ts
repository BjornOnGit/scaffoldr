import { describe, expect, test } from 'vitest';
import { fileEntrySchema, fileStrategySchema } from './file-entry.js';

const minimal = { from: 'files/lib/paystack.ts.hbs', to: 'src/lib/paystack.ts' };

describe('fileEntrySchema', () => {
  test('applies the defaults for strategy and target', () => {
    expect(fileEntrySchema.parse(minimal)).toEqual({
      ...minimal,
      strategy: 'overwrite',
      target: 'app',
    });
  });

  test('keeps explicit strategy and target values', () => {
    const entry = { ...minimal, strategy: 'json-merge', target: 'shared' };
    expect(fileEntrySchema.parse(entry)).toEqual(entry);
  });

  test('rejects an unknown strategy', () => {
    expect(fileEntrySchema.safeParse({ ...minimal, strategy: 'replace' }).success).toBe(false);
  });

  test('rejects an unknown target', () => {
    expect(fileEntrySchema.safeParse({ ...minimal, target: 'server' }).success).toBe(false);
  });

  test('rejects a missing from', () => {
    expect(fileEntrySchema.safeParse({ to: 'src/x.ts' }).success).toBe(false);
  });

  test('rejects a to path that escapes the project', () => {
    expect(fileEntrySchema.safeParse({ ...minimal, to: '../outside.ts' }).success).toBe(false);
  });
});

describe('fileStrategySchema', () => {
  test.each([
    'overwrite',
    'json-merge',
    'env-merge',
    'inject',
    'ast-patch',
    'append',
    'prisma-merge',
  ])('accepts %s', (value) => {
    expect(fileStrategySchema.safeParse(value).success).toBe(true);
  });
});