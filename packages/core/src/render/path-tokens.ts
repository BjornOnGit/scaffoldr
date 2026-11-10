import { ScaffoldrError } from '../errors/index.js';

/** Double-underscore folders that test tools use. They are real names, never tokens. */
const reservedNames = new Set(['tests', 'mocks', 'snapshots', 'fixtures']);

const tokenPattern = /__([A-Za-z][A-Za-z0-9]*)__/g;

/**
 * Replaces every `__token__` in a file path with its value from `context`,
 * e.g. `__eventSlug__/page.tsx` becomes `lagos-night/page.tsx`.
 *
 * - A token with no value in `context` (or an empty one) throws `INVALID_CONFIG`.
 * - A value that contains a slash or backslash, or is `.` or `..`, throws `UNSAFE_PATH`,
 *   so a value can never add folders or climb out of the project.
 * - `__tests__`, `__mocks__`, `__snapshots__` and `__fixtures__` are left alone.
 */
export function renderPathTokens(
  path: string,
  context: Record<string, string>,
): string {
  return path.replace(tokenPattern, (match: string, name: string) => {
    if (reservedNames.has(name)) {
      return match;
    }
    const value = Object.hasOwn(context, name) ? context[name] : undefined;
    if (value === undefined || value === '') {
      throw new ScaffoldrError(
        'INVALID_CONFIG',
        `The path "${path}" uses the token "${match}" but no value was given for "${name}".`,
        {
          hint: `Provide a value for "${name}", for example with a blueprint question.`,
          details: { path, token: name },
        },
      );
    }
    if (/[\\/]/.test(value) || value === '.' || value === '..') {
      throw new ScaffoldrError(
        'UNSAFE_PATH',
        `The value for "${name}" cannot be used in a file path: "${value}".`,
        {
          hint: 'Use a plain name without slashes, "." or "..".',
          details: { path, token: name, value },
        },
      );
    }
    return value;
  });
}
