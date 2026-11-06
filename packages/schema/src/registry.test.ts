import { describe, expect, test } from 'vitest';
import { registryIndexSchema } from './registry.js';

const digest = 'f'.repeat(64);

const sampleIndex = {
  registryVersion: '2026.11.0',
  layers: [
    {
      id: 'next-app',
      name: 'Next.js (App Router)',
      version: '0.1.0',
      description: 'Next.js with the App Router',
      path: 'layers/next-app',
    },
  ],
  blueprints: [
    {
      id: 'ticketing',
      name: 'Event Ticketing',
      description: 'Sell tickets, issue QR codes, check guests in.',
      path: 'blueprints/ticketing',
    },
  ],
  modules: [
    {
      id: 'payments-paystack',
      name: 'Paystack Payments',
      version: '0.1.0',
      path: 'modules/payments-paystack',
      sha256: digest,
    },
    { id: 'db-prisma', name: 'Prisma', path: 'modules/db-prisma' },
  ],
};

describe('registryIndexSchema', () => {
  test('accepts a sample index', () => {
    const result = registryIndexSchema.safeParse(sampleIndex);
    expect(result.success).toBe(true);
  });

  test('accepts an index with empty lists', () => {
    const result = registryIndexSchema.safeParse({
      registryVersion: '2026.11.0',
      layers: [],
      blueprints: [],
      modules: [],
    });
    expect(result.success).toBe(true);
  });

  test('rejects an index without registryVersion', () => {
    const { registryVersion, ...withoutVersion } = sampleIndex;
    expect(registryIndexSchema.safeParse(withoutVersion).success).toBe(false);
  });

  test('rejects an entry without a path', () => {
    const result = registryIndexSchema.safeParse({
      ...sampleIndex,
      modules: [{ id: 'db-prisma', name: 'Prisma' }],
    });
    expect(result.success).toBe(false);
  });

  test('rejects an entry path that escapes the registry', () => {
    const result = registryIndexSchema.safeParse({
      ...sampleIndex,
      modules: [{ id: 'db-prisma', name: 'Prisma', path: '../db-prisma' }],
    });
    expect(result.success).toBe(false);
  });

  test('rejects an entry sha256 that is not a SHA-256 digest', () => {
    const result = registryIndexSchema.safeParse({
      ...sampleIndex,
      modules: [{ id: 'db-prisma', name: 'Prisma', path: 'modules/db-prisma', sha256: 'abc' }],
    });
    expect(result.success).toBe(false);
  });
});