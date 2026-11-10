import { z } from 'zod';

/** Lowercase letters, digits and hyphens, 2-60 characters. */
export const idSchema = z
  .string()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9-]+$/, 'Use only lowercase letters, digits and hyphens');

const numericIdentifier = '(?:0|[1-9]\\d*)';
const prerelease = `(?:-(?:${numericIdentifier}|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:${numericIdentifier}|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*)`;
const build = '(?:\\+[0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*)';

const semverPattern = new RegExp(
  `^${numericIdentifier}\\.${numericIdentifier}\\.${numericIdentifier}${prerelease}?${build}?$`,
);

/** A strict semantic version (semver.org 2.0.0), e.g. `1.2.3-beta.1+build.5`. */
export const semverSchema = z
  .string()
  .regex(semverPattern, 'Expected a semantic version such as 1.2.3');

const wildcard = '[xX*]';
const part = `(?:${wildcard}|${numericIdentifier})`;
const partialVersion = `(?:${part}(?:\\.${part}(?:\\.${part}${prerelease}?${build}?)?)?)`;
const comparator = new RegExp(`^(?:\\^|~>?|>=|<=|>|<|=)?${partialVersion}$`);
const partialOnly = new RegExp(`^${partialVersion}$`);

function isValidComparatorSet(set: string): boolean {
  const trimmed = set.trim();
  if (trimmed === '') {
    return true; // an empty set means "any version"
  }
  const hyphen = trimmed.split(/\s+-\s+/);
  if (hyphen.length === 2) {
    return hyphen.every((side) => partialOnly.test(side));
  }
  if (hyphen.length > 2) {
    return false;
  }
  return trimmed.split(/\s+/).every((token) => comparator.test(token));
}

/**
 * An npm-style semver range: `^1.2.3`, `~1.2`, `>=1.0.0 <2.0.0`, `1.x`, `*`,
 * `1.2.3 - 2.0.0`, or several of these joined with `||`.
 */
export const semverRangeSchema = z
  .string()
  .min(1)
  .refine((value) => value.split('||').every(isValidComparatorSet), {
    message: 'Expected a semantic version range such as ^1.2.0',
  });

/** A path relative to its root: not absolute and never containing a `..` segment. */
export const relativePathSchema = z
  .string()
  .min(1)
  .refine((value) => !(value.startsWith('/') || value.startsWith('\\')), {
    message: 'Path must be relative, not absolute',
  })
  .refine((value) => !/^[a-zA-Z]:/.test(value), {
    message: 'Path must be relative, not absolute',
  })
  .refine((value) => !value.split(/[\\/]/).includes('..'), {
    message: 'Path must not contain ".." segments',
  });
