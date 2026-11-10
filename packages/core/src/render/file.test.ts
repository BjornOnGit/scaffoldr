import { describe, expect, test } from 'vitest';
import { ScaffoldrError } from '../errors/index.js';
import { renderFile } from './file.js';

function codeOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof ScaffoldrError ? error.code : undefined;
  }
  return undefined;
}

describe('renderFile: .hbs files', () => {
  test('renders the template and strips the suffix', () => {
    const result = renderFile(
      'src/lib/config.ts.hbs',
      'export const name = "{{name}}";',
      {
        name: 'Detty Night',
      },
    );

    expect(result).toEqual({
      path: 'src/lib/config.ts',
      content: 'export const name = "Detty Night";',
    });
  });

  test('renders bytes as UTF-8 text', () => {
    const bytes = new TextEncoder().encode('Hello {{name}}');

    expect(renderFile('a.txt.hbs', bytes, { name: 'Ada' })).toEqual({
      path: 'a.txt',
      content: 'Hello Ada',
    });
  });

  test('throws INVALID_CONFIG when the template uses a missing variable', () => {
    expect(codeOf(() => renderFile('a.txt.hbs', '{{missing}}', {}))).toBe(
      'INVALID_CONFIG',
    );
  });

  test('only strips .hbs from the end of the path', () => {
    expect(renderFile('a.hbs.ts', 'x', {}).path).toBe('a.hbs.ts');
  });
});

describe('renderFile: other files are copied verbatim', () => {
  test('a non-.hbs file containing {{ x }} is untouched', () => {
    const source = 'const a = "{{ x }}";\nconst b = "{{y}}";';
    const result = renderFile('src/note.txt', source, {});

    expect(result).toEqual({ path: 'src/note.txt', content: source });
  });

  test('JSX double braces are untouched', () => {
    const source = '<div style={{ color: "red" }} className="p-4" />';

    expect(renderFile('src/App.tsx', source, { color: 'blue' }).content).toBe(
      source,
    );
  });

  test('binary content is passed through as the same bytes', () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 0, 255]);
    const result = renderFile('public/logo.png', bytes, {});

    expect(result.content).toBe(bytes);
    expect(result.path).toBe('public/logo.png');
  });
});

describe('renderFile: _gitignore', () => {
  test.each([
    ['_gitignore', '.gitignore'],
    ['apps/web/_gitignore', 'apps/web/.gitignore'],
    ['apps\\web\\_gitignore', 'apps\\web\\.gitignore'],
  ])('renames %j to %j', (input, expected) => {
    expect(renderFile(input, 'node_modules\n', {}).path).toBe(expected);
  });

  test('renames _gitignore.hbs to .gitignore and renders it', () => {
    const result = renderFile('_gitignore.hbs', '{{outDir}}\n', {
      outDir: 'dist',
    });

    expect(result).toEqual({ path: '.gitignore', content: 'dist\n' });
  });

  test.each([
    '_gitignore.bak',
    'my_gitignore',
    '_gitignore/file.txt',
    'x/_gitignored',
  ])('does not rename %j', (input) => {
    expect(renderFile(input, 'x', {}).path).toBe(input);
  });
});

describe('renderFile: path tokens', () => {
  test('fills tokens in the path and renders the content', () => {
    const result = renderFile(
      '__eventSlug__/page.tsx.hbs',
      'export const title = "{{title}}";',
      {
        eventSlug: 'lagos-detty-night',
        title: 'Detty Night',
      },
    );

    expect(result).toEqual({
      path: 'lagos-detty-night/page.tsx',
      content: 'export const title = "Detty Night";',
    });
  });

  test('fills tokens in files that are copied verbatim', () => {
    expect(
      renderFile('__section__/data.json', '{}', { section: 'events' }).path,
    ).toBe('events/data.json');
  });

  test('accepts a number as a token value', () => {
    expect(renderFile('v__major__/a.txt', 'x', { major: 2 }).path).toBe(
      'v2/a.txt',
    );
  });

  test('throws INVALID_CONFIG for a token with no value', () => {
    expect(codeOf(() => renderFile('__eventSlug__/page.tsx', 'x', {}))).toBe(
      'INVALID_CONFIG',
    );
  });

  test('throws INVALID_CONFIG when the token value is not text or a number', () => {
    expect(
      codeOf(() => renderFile('__flag__/a.txt', 'x', { flag: true })),
    ).toBe('INVALID_CONFIG');
  });

  test('throws UNSAFE_PATH when a token value would climb out of the project', () => {
    expect(codeOf(() => renderFile('__dir__/a.txt', 'x', { dir: '..' }))).toBe(
      'UNSAFE_PATH',
    );
  });
});
