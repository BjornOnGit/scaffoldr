import { describe, expect, test } from 'vitest';
import { ScaffoldrError } from '../errors/index.js';
import { renderTemplate } from './template.js';

function thrownBy(run: () => unknown): ScaffoldrError {
  try {
    run();
  } catch (error) {
    return error as ScaffoldrError;
  }
  throw new Error('Expected the call to throw');
}

describe('renderTemplate', () => {
  test('substitutes variables', () => {
    const result = renderTemplate('const name = "{{eventName}}";', {
      eventName: 'Detty Night',
    });

    expect(result).toBe('const name = "Detty Night";');
  });

  test('substitutes nested values', () => {
    expect(renderTemplate('{{event.city}}', { event: { city: 'Lagos' } })).toBe(
      'Lagos',
    );
  });

  test('does not HTML-escape the output', () => {
    const result = renderTemplate('{{code}}', {
      code: '<a href="x">a & b</a>',
    });

    expect(result).toBe('<a href="x">a & b</a>');
  });

  test('throws INVALID_CONFIG for a missing variable', () => {
    const error = thrownBy(() => renderTemplate('Hello {{name}}', {}));

    expect(error).toBeInstanceOf(ScaffoldrError);
    expect(error.code).toBe('INVALID_CONFIG');
    expect(error.message).toContain('"name" not defined');
    expect(error.hint).toBeTruthy();
  });

  test('throws for a missing nested variable', () => {
    const error = thrownBy(() =>
      renderTemplate('{{event.city}}', { event: {} }),
    );

    expect(error.code).toBe('INVALID_CONFIG');
  });

  test('throws INVALID_CONFIG for a syntax error', () => {
    const error = thrownBy(() => renderTemplate('{{#if}}', {}));

    expect(error.code).toBe('INVALID_CONFIG');
  });

  test('{{#if}} renders the true branch', () => {
    const template = '{{#if withEmail}}import email;{{/if}}done';

    expect(renderTemplate(template, { withEmail: true })).toBe(
      'import email;done',
    );
  });

  test('{{#if}} skips the block when false and supports {{else}}', () => {
    const template = '{{#if withEmail}}email{{else}}no email{{/if}}';

    expect(renderTemplate(template, { withEmail: false })).toBe('no email');
  });

  test('{{#if}} treats an undefined condition as false', () => {
    expect(
      renderTemplate('{{#if withEmail}}email{{else}}no email{{/if}}', {}),
    ).toBe('no email');
  });

  test('{{#each}} loops over a list', () => {
    const template = '{{#each currencies}}{{this}};{{/each}}';

    expect(renderTemplate(template, { currencies: ['NGN', 'GHS'] })).toBe(
      'NGN;GHS;',
    );
  });

  test('leaves text without braces unchanged', () => {
    expect(renderTemplate('plain text\n', {})).toBe('plain text\n');
  });
});
