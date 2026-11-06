import { describe, expect, test } from 'vitest';
import { layerManifestSchema } from './layer.js';

const validManifest = {
  $schema: 'https://scaffoldr.dev/schema/layer.json',
  id: 'next-app',
  name: 'Next.js (App Router)',
  engines: { node: '>=20', scaffoldr: '^0.1.0' },
  injectionPoints: ['providers', 'nav', 'routes', 'env-schema'],
  packageJson: { dependencies: { next: '^16.0.0', react: '^19.0.0' } },
  monorepo: { appDir: 'apps/web' },
};

describe('layerManifestSchema', () => {
  test('accepts a valid manifest', () => {
    const result = layerManifestSchema.safeParse(validManifest);
    expect(result.success).toBe(true);
  });

  test('accepts a manifest with only the required fields', () => {
    const { $schema, packageJson, monorepo, ...required } = validManifest;
    expect(layerManifestSchema.safeParse(required).success).toBe(true);
  });

  test('rejects an invalid id', () => {
    const result = layerManifestSchema.safeParse({ ...validManifest, id: 'Next_App' });
    expect(result.success).toBe(false);
  });

  test('rejects a manifest missing engines.node', () => {
    const result = layerManifestSchema.safeParse({
      ...validManifest,
      engines: { scaffoldr: '^0.1.0' },
    });
    expect(result.success).toBe(false);
  });

  test('rejects a monorepo appDir that escapes the project', () => {
    const result = layerManifestSchema.safeParse({
      ...validManifest,
      monorepo: { appDir: '../web' },
    });
    expect(result.success).toBe(false);
  });
});