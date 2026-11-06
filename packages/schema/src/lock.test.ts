import { describe, expect, test } from 'vitest';
import { lockFileSchema } from './lock.js';

const digestA = 'a'.repeat(64);
const digestB = '0123456789abcdef'.repeat(4);

// The scaffoldr.json example from architecture section 6.1, with real digests
// in place of the "…" placeholders.
const lock = {
  $schema: 'https://scaffoldr.dev/schema/lock.json',
  scaffoldrVersion: '0.1.0',
  registryVersion: '2026.11.0',
  blueprint: 'ticketing',
  layer: 'next-app',
  answers: { eventName: 'Lagos Detty Night', currency: 'NGN' },
  modules: [
    { id: 'payments-paystack', version: '0.1.0', source: 'bundled' },
    { id: 'db-prisma', version: '0.1.0', source: 'bundled' },
  ],
  files: {
    'src/lib/paystack.ts': { owner: 'payments-paystack', sha256: digestA },
    'package.json': { owner: 'merged', sha256: digestB },
  },
};

describe('lockFileSchema', () => {
  test('parses the example from architecture section 6.1', () => {
    const result = lockFileSchema.safeParse(lock);
    expect(result.success).toBe(true);
  });

  test('rejects a lock file without blueprint', () => {
    const { blueprint, ...withoutBlueprint } = lock;
    expect(lockFileSchema.safeParse(withoutBlueprint).success).toBe(false);
  });

  test('accepts the optional monorepo flag and boolean answers', () => {
    const result = lockFileSchema.safeParse({
      ...lock,
      monorepo: true,
      answers: { ...lock.answers, sendEmails: false },
    });
    expect(result.success).toBe(true);
  });

  test('rejects a module source other than bundled or remote', () => {
    const result = lockFileSchema.safeParse({
      ...lock,
      modules: [{ id: 'db-prisma', version: '0.1.0', source: 'local' }],
    });
    expect(result.success).toBe(false);
  });

  test('rejects a file checksum that is not a SHA-256 digest', () => {
    const result = lockFileSchema.safeParse({
      ...lock,
      files: { 'src/lib/paystack.ts': { owner: 'payments-paystack', sha256: '…' } },
    });
    expect(result.success).toBe(false);
  });

  test('rejects a file path that escapes the project', () => {
    const result = lockFileSchema.safeParse({
      ...lock,
      files: { '../outside.ts': { owner: 'payments-paystack', sha256: digestA } },
    });
    expect(result.success).toBe(false);
  });
});