import { describe, expect, test } from 'vitest';
import { ScaffoldrError, errorCodes } from './index.js';

describe('ScaffoldrError', () => {
  test('exposes code and hint', () => {
    const error = new ScaffoldrError('UNKNOWN_MODULE', 'No module called "payments-x".', {
      hint: 'Run `scaffoldr list` to see the available modules.',
    });

    expect(error.code).toBe('UNKNOWN_MODULE');
    expect(error.hint).toBe('Run `scaffoldr list` to see the available modules.');
    expect(error.message).toBe('No module called "payments-x".');
  });

  test('exposes details when given', () => {
    const details = { moduleId: 'payments-x', available: ['payments-paystack'] };
    const error = new ScaffoldrError('UNKNOWN_MODULE', 'Unknown module.', { details });

    expect(error.details).toEqual(details);
  });

  test('leaves hint and details undefined when omitted', () => {
    const error = new ScaffoldrError('INVALID_CONFIG', 'Bad config.');

    expect(error.hint).toBeUndefined();
    expect(error.details).toBeUndefined();
  });

  test('is an instance of ScaffoldrError and Error', () => {
    const error = new ScaffoldrError('UNSAFE_PATH', 'Path escapes the project.');

    expect(error).toBeInstanceOf(ScaffoldrError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ScaffoldrError');
  });

  test('is still recognisable after being thrown and caught', () => {
    let caught: unknown;
    try {
      throw new ScaffoldrError('TARGET_NOT_EMPTY', 'Target folder is not empty.');
    } catch (error) {
      caught = error;
    }

    expect(caught instanceof ScaffoldrError).toBe(true);
    expect(caught instanceof ScaffoldrError && caught.code).toBe('TARGET_NOT_EMPTY');
  });

  test('has a stack trace', () => {
    const error = new ScaffoldrError('MERGE_CONFLICT', 'Cannot merge.');

    expect(error.stack).toContain('ScaffoldrError');
  });
});

describe('errorCodes', () => {
  test('lists all twelve codes', () => {
    expect([...errorCodes]).toEqual([
      'INVALID_CONFIG',
      'UNKNOWN_BLUEPRINT',
      'UNKNOWN_MODULE',
      'SLOT_REQUIRED',
      'MODULE_CONFLICT',
      'MODULE_REQUIRES',
      'DEPENDENCY_CYCLE',
      'UNSAFE_PATH',
      'TARGET_NOT_EMPTY',
      'MERGE_CONFLICT',
      'MARKER_NOT_FOUND',
      'NOT_A_SCAFFOLDR_PROJECT',
    ]);
  });
});