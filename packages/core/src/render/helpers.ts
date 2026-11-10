import type Handlebars from 'handlebars';

/** Splits `eventName`, `event-name`, `Event Name` and `EVENT_NAME` into lowercase words. */
function words(input: string): string[] {
  return (
    input
      .replace(/(\p{Ll}|\p{N})(\p{Lu})/gu, '$1 $2')
      .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, '$1 $2')
      .match(/[\p{L}\p{N}]+/gu)
      ?.map((word) => word.toLowerCase()) ?? []
  );
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Case helpers need real text. A missing value is an error, not an empty string. */
function textArg(helper: string, value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  throw new Error(`Helper "${helper}" needs a string but got ${typeof value}`);
}

/**
 * Adds the template helpers to a Handlebars environment:
 * `kebab`, `pascal`, `camel`, `upper`, `eq` and `json`.
 */
export function registerHelpers(handlebars: typeof Handlebars): void {
  handlebars.registerHelper('kebab', (value: unknown) =>
    words(textArg('kebab', value)).join('-'),
  );

  handlebars.registerHelper('pascal', (value: unknown) =>
    words(textArg('pascal', value)).map(capitalize).join(''),
  );

  handlebars.registerHelper('camel', (value: unknown) =>
    words(textArg('camel', value))
      .map((word, index) => (index === 0 ? word : capitalize(word)))
      .join(''),
  );

  handlebars.registerHelper('upper', (value: unknown) =>
    textArg('upper', value).toUpperCase(),
  );

  // Handlebars passes its own options object as the last argument, so `eq` only reads two.
  handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);

  // `{{json value}}` is compact; `{{json value 2}}` indents by two spaces.
  handlebars.registerHelper('json', (value: unknown, indent: unknown) => {
    if (value === undefined) {
      throw new Error('Helper "json" needs a value but got undefined');
    }
    return JSON.stringify(
      value,
      null,
      typeof indent === 'number' ? indent : undefined,
    );
  });
}
