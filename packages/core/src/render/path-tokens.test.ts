import { describe, expect, test } from 'vitest';
import { ScaffoldrError } from '../errors/index.js';
import { renderPathTokens } from './path-tokens.js';

function thrownBy(run: () => unknown): ScaffoldrError {
  try {
    run();
  } catch (error) {
    return error as ScaffoldrError;
  }
  throw new Error('Expected the call to throw');
}

describe('renderPathTokens', () => {
  test('renders __eventSlug__/page.tsx from the context', () => {
    const result = renderPathTokens('__eventSlug__/page.tsx', {
      eventSlug: 'lagos-detty-night',
    });

    expect(result).toBe('lagos-detty-night/page.tsx');
  });

  test('throws INVALID_CONFIG when a token is missing', () => {
    const error = thrownBy(() =>
      renderPathTokens('__eventSlug__/page.tsx', {}),
    );

    expect(error).toBeInstanceOf(ScaffoldrError);
    expect(error.code).toBe('INVALID_CONFIG');
    expect(error.details).toEqual({
      path: '__eventSlug__/page.tsx',
      token: 'eventSlug',
    });
    expect(error.hint).toBeTruthy();
  });

  test('renders several tokens, including inside a file name', () => {
    const result = renderPathTokens('app/__section__/__eventSlug__-card.tsx', {
      section: 'events',
      eventSlug: 'detty',
    });

    expect(result).toBe('app/events/detty-card.tsx');
  });

  test('renders the same token more than once', () => {
    expect(renderPathTokens('__a__/__a__.ts', { a: 'x' })).toBe('x/x.ts');
  });

  test('leaves paths without tokens unchanged', () => {
    expect(renderPathTokens('src/lib/paystack.ts', {})).toBe(
      'src/lib/paystack.ts',
    );
  });

  test('ignores context keys that the path does not use', () => {
    expect(renderPathTokens('a.ts', { unused: 'x' })).toBe('a.ts');
  });

  test.each(['__tests__', '__mocks__', '__snapshots__', '__fixtures__'])(
    'leaves %s alone even with an empty context',
    (folder) => {
      expect(renderPathTokens(`${folder}/webhook.test.ts`, {})).toBe(
        `${folder}/webhook.test.ts`,
      );
    },
  );

  test('does not treat names inherited from Object as provided', () => {
    const error = thrownBy(() => renderPathTokens('__constructor__/a.ts', {}));

    expect(error.code).toBe('INVALID_CONFIG');
  });

  test('treats an empty value as missing', () => {
    const error = thrownBy(() => renderPathTokens('__name__.ts', { name: '' }));

    expect(error.code).toBe('INVALID_CONFIG');
  });

  test.each(['a/b', 'a\\b', '..', '.', '../x', '/abs'])(
    'rejects the unsafe value %j with UNSAFE_PATH',
    (value) => {
      const error = thrownBy(() =>
        renderPathTokens('__name__/page.tsx', { name: value }),
      );

      expect(error.code).toBe('UNSAFE_PATH');
    },
  );
});
