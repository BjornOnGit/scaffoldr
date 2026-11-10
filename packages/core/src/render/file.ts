import { renderPathTokens } from './path-tokens.js';
import { renderTemplate } from './template.js';

export interface RenderedFile {
  path: string;
  content: string | Uint8Array;
}

/** Only text and number values can fill a `__token__` in a path. */
function pathContext(ctx: Record<string, unknown>): Record<string, string> {
  const context: Record<string, string> = {};
  for (const [key, value] of Object.entries(ctx)) {
    if (typeof value === 'string' || typeof value === 'number') {
      context[key] = String(value);
    }
  }
  return context;
}

/**
 * Turns one registry file into the file to write:
 * 1. `__token__` parts of the path are filled in from `ctx`.
 * 2. A path ending in `.hbs` is rendered as a Handlebars template and loses the suffix.
 *    Every other file is copied as is, so `{{ }}` in JSX or Tailwind is never touched.
 * 3. A file named `_gitignore` becomes `.gitignore`.
 */
export function renderFile(
  relPath: string,
  content: string | Uint8Array,
  ctx: Record<string, unknown>,
): RenderedFile {
  let path = renderPathTokens(relPath, pathContext(ctx));
  let output = content;

  if (path.endsWith('.hbs')) {
    path = path.slice(0, -'.hbs'.length);
    const source =
      typeof content === 'string' ? content : new TextDecoder().decode(content);
    output = renderTemplate(source, ctx);
  }

  path = path.replace(/(^|[\\/])_gitignore$/, '$1.gitignore');
  return { path, content: output };
}
