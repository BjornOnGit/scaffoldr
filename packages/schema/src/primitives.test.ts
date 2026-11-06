import { describe, expect, test } from 'vitest';
import {
  idSchema,
  relativePathSchema,
  semverRangeSchema,
  semverSchema,
} from './primitives.js';

describe('idSchema', () => {
  test.each(['db-prisma', 'auth-better-auth', 'a1', 'ab', 'a'.repeat(60)])(
    'accepts %s',
    (value) => {
      expect(idSchema.safeParse(value).success).toBe(true);
    },
  );

  test.each([
    'Bad_ID',
    'UPPER',
    'has space',
    'under_score',
    'x',
    '',
    'a'.repeat(61),
  ])('rejects %j', (value) => {
    expect(idSchema.safeParse(value).success).toBe(false);
  });
});

describe('semverSchema', () => {
  test.each(['0.0.0', '1.2.3', '1.0.0-beta.1', '1.0.0+build.5', '10.20.30-rc.1+sha.abc'])(
    'accepts %s',
    (value) => {
      expect(semverSchema.safeParse(value).success).toBe(true);
    },
  );

  test.each(['1.2', 'v1.2.3', '01.2.3', '1.2.3.4', '1.2.3-', '^1.2.3', ''])(
    'rejects %j',
    (value) => {
      expect(semverSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe('semverRangeSchema', () => {
  test.each([
    '^1.2.3',
    '~1.2',
    '>=1.0.0 <2.0.0',
    '1.x',
    '*',
    '1.2.3',
    '1.2.3 - 2.0.0',
    '^1.0.0 || ^2.0.0',
    '>1.0.0-beta.1',
  ])('accepts %s', (value) => {
    expect(semverRangeSchema.safeParse(value).success).toBe(true);
  });

  test.each(['banana', '^', '>=', '1.2.3 -', '^^1.0.0', 'v1.2.3', ''])(
    'rejects %j',
    (value) => {
      expect(semverRangeSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe('relativePathSchema', () => {
  test.each(['src/index.ts', './x', 'a/b/c.txt', 'file..name', '.hidden'])(
    'accepts %s',
    (value) => {
      expect(relativePathSchema.safeParse(value).success).toBe(true);
    },
  );

  test.each(['../x', '/abs', 'a/../b', '..', 'a\\..\\b', '\\\\server\\share', 'C:\\x', ''])(
    'rejects %j',
    (value) => {
      expect(relativePathSchema.safeParse(value).success).toBe(false);
    },
  );
});