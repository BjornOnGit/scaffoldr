import Handlebars from 'handlebars';
import { ScaffoldrError } from '../errors/index.js';
import { registerHelpers } from './helpers.js';

/** A private Handlebars environment, so nothing outside `core` can change its helpers. */
const handlebars = Handlebars.create();
registerHelpers(handlebars);

/**
 * Renders a Handlebars template. Output is not HTML-escaped, because the files are code,
 * and strict mode is on: a variable the template uses but `ctx` does not provide is an error.
 * (`{{#if x}}` with an undefined `x` is not an error. Handlebars treats it as false.)
 *
 * Any Handlebars failure, including a syntax error, is thrown as `INVALID_CONFIG`.
 */
export function renderTemplate(
  source: string,
  ctx: Record<string, unknown>,
): string {
  try {
    return handlebars.compile(source, { noEscape: true, strict: true })(ctx);
  } catch (error) {
    const reason =
      error instanceof Error
        ? (error.message.split('\n')[0] ?? '')
        : String(error);
    throw new ScaffoldrError('INVALID_CONFIG', `Template error: ${reason}`, {
      hint: 'Check that every variable the template uses is provided, and that its syntax is valid.',
      details: { reason },
    });
  }
}
