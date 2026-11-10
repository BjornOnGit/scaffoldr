import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLayer } from '@scaffoldr/registry-client';
import { describe, expect, test } from 'vitest';

const registryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'registry');

describe('layer astro-starlight', () => {
  test('loads from the real registry and passes the layer schema', async () => {
    const { manifest, dir } = await loadLayer('astro-starlight', { registryRoot });

    expect(manifest.id).toBe('astro-starlight');
    expect(manifest.name).toBe('Astro Starlight');
    expect(path.basename(dir)).toBe('astro-starlight');
  });

  test('has the nav and env-schema injection points', async () => {
    const { manifest } = await loadLayer('astro-starlight', { registryRoot });

    expect(manifest.injectionPoints).toEqual(['nav', 'env-schema']);
  });

  test('depends on astro and @astrojs/starlight', async () => {
    const { manifest } = await loadLayer('astro-starlight', { registryRoot });

    expect(Object.keys(manifest.packageJson?.dependencies ?? {})).toEqual([
      'astro',
      '@astrojs/starlight',
    ]);
  });

  test('requires a Node version that astro supports', async () => {
    const { manifest } = await loadLayer('astro-starlight', { registryRoot });

    expect(manifest.engines.node).toBe('>=22.23.4');
  });
});