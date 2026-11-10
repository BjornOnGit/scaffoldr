import { describe, expect, test } from 'vitest';
import { moduleManifestSchema } from './module.js';

// The module.json example from architecture section 5.3.
const paystack = {
  $schema: 'https://scaffoldr.dev/schema/module.json',
  id: 'payments-paystack',
  name: 'Paystack Payments',
  version: '0.1.0',
  slot: 'payments',
  requires: ['db-*'],
  conflicts: ['payments-flutterwave', 'payments-monnify'],
  supports: { layers: ['next-app'] },
  packageJson: { dependencies: { 'paystack-sdk': '^1.0.0' } },
  env: [
    {
      key: 'PAYSTACK_SECRET_KEY',
      description: 'Secret key from the Paystack dashboard',
      required: true,
    },
    { key: 'PAYSTACK_WEBHOOK_SECRET', required: true },
  ],
  files: [
    {
      from: 'files/lib/paystack.ts.hbs',
      to: 'src/lib/paystack.ts',
      strategy: 'overwrite',
    },
  ],
  inject: [{ point: 'env-schema', from: 'patches/env.inject.ts' }],
  notes: [
    'Add your webhook URL in the Paystack dashboard: /api/paystack/webhook',
  ],
};

describe('moduleManifestSchema', () => {
  test('parses the Paystack example from architecture section 5.3', () => {
    const result = moduleManifestSchema.safeParse(paystack);
    expect(result.success).toBe(true);
  });

  test('applies defaults to files entries in the Paystack example', () => {
    const parsed = moduleManifestSchema.parse(paystack);
    expect(parsed.files[0]).toEqual({
      from: 'files/lib/paystack.ts.hbs',
      to: 'src/lib/paystack.ts',
      strategy: 'overwrite',
      target: 'app',
    });
  });

  test('defaults every array to empty when omitted', () => {
    const parsed = moduleManifestSchema.parse({
      id: 'db-prisma',
      name: 'Prisma',
      version: '0.1.0',
      supports: {},
    });
    expect(parsed).toEqual({
      id: 'db-prisma',
      name: 'Prisma',
      version: '0.1.0',
      requires: [],
      conflicts: [],
      supports: { layers: [] },
      env: [],
      files: [],
      inject: [],
      notes: [],
    });
  });

  test('rejects a manifest without id', () => {
    const { id, ...withoutId } = paystack;
    expect(moduleManifestSchema.safeParse(withoutId).success).toBe(false);
  });

  test('rejects a version that is not semver', () => {
    expect(
      moduleManifestSchema.safeParse({ ...paystack, version: '1.0' }).success,
    ).toBe(false);
  });

  test('rejects an env entry without required', () => {
    const result = moduleManifestSchema.safeParse({
      ...paystack,
      env: [{ key: 'PAYSTACK_SECRET_KEY' }],
    });
    expect(result.success).toBe(false);
  });

  test('rejects an inject entry that escapes the module folder', () => {
    const result = moduleManifestSchema.safeParse({
      ...paystack,
      inject: [{ point: 'env-schema', from: '../env.inject.ts' }],
    });
    expect(result.success).toBe(false);
  });
});
