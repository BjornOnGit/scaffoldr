import { describe, expect, test } from 'vitest';
import { ScaffoldrError } from '../errors/index.js';
import { renderTemplate } from './template.js';

function codeOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof ScaffoldrError ? error.code : undefined;
  }
  return undefined;
}

describe('kebab', () => {
  test.each([
    ['Lagos Detty Night', 'lagos-detty-night'],
    ['eventName', 'event-name'],
    ['Event_Name', 'event-name'],
    ['payments-paystack', 'payments-paystack'],
    ['HTTPServer', 'http-server'],
  ])('kebab(%j) is %j', (input, expected) => {
    expect(renderTemplate('{{kebab value}}', { value: input })).toBe(expected);
  });
});

describe('pascal', () => {
  test.each([
    ['event name', 'EventName'],
    ['event-name', 'EventName'],
    ['eventName', 'EventName'],
    ['API key', 'ApiKey'],
  ])('pascal(%j) is %j', (input, expected) => {
    expect(renderTemplate('{{pascal value}}', { value: input })).toBe(expected);
  });
});

describe('camel', () => {
  test.each([
    ['Event Name', 'eventName'],
    ['payments-paystack', 'paymentsPaystack'],
    ['EventName', 'eventName'],
    ['single', 'single'],
  ])('camel(%j) is %j', (input, expected) => {
    expect(renderTemplate('{{camel value}}', { value: input })).toBe(expected);
  });
});

describe('upper', () => {
  test('uppercases text', () => {
    expect(renderTemplate('{{upper value}}', { value: 'paystack' })).toBe(
      'PAYSTACK',
    );
  });

  test('turns a name into an env var style key', () => {
    expect(renderTemplate('{{upper "ngn"}}_KEY', {})).toBe('NGN_KEY');
  });
});

describe('eq', () => {
  const template = '{{#if (eq currency "NGN")}}naira{{else}}other{{/if}}';

  test('is true for equal values', () => {
    expect(renderTemplate(template, { currency: 'NGN' })).toBe('naira');
  });

  test('is false for different values', () => {
    expect(renderTemplate(template, { currency: 'GHS' })).toBe('other');
  });

  test('compares strictly, so 1 and "1" differ', () => {
    expect(
      renderTemplate('{{#if (eq n "1")}}same{{else}}diff{{/if}}', { n: 1 }),
    ).toBe('diff');
  });
});

describe('json', () => {
  test('writes compact JSON for an object', () => {
    const result = renderTemplate('const x = {{json value}};', {
      value: { a: 1, b: ['x'] },
    });

    expect(result).toBe('const x = {"a":1,"b":["x"]};');
  });

  test('quotes strings without HTML-escaping them', () => {
    expect(renderTemplate('{{json value}}', { value: 'say "hi" & go' })).toBe(
      '"say \\"hi\\" & go"',
    );
  });

  test('indents when given a number', () => {
    expect(renderTemplate('{{json value 2}}', { value: { a: 1 } })).toBe(
      '{\n  "a": 1\n}',
    );
  });
});

describe('missing values', () => {
  test.each(['kebab', 'pascal', 'camel', 'upper', 'json'])(
    '%s throws INVALID_CONFIG when the value is missing',
    (helper) => {
      expect(codeOf(() => renderTemplate(`{{${helper} value}}`, {}))).toBe(
        'INVALID_CONFIG',
      );
    },
  );

  test('case helpers reject values that are not text', () => {
    expect(
      codeOf(() => renderTemplate('{{kebab value}}', { value: { a: 1 } })),
    ).toBe('INVALID_CONFIG');
  });
});
