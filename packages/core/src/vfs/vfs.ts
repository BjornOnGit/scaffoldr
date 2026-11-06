export interface VfsEntry {
  content: string | Uint8Array;
  /** The layer or module id that produced this file. */
  owner: string;
}

/**
 * Turns a path into its stored form: forward slashes, no empty or `.` segments.
 * `..` segments and a leading `/` are kept as written, so path safety checks still see them.
 */
function normalizePath(path: string): string {
  const segments = path.replaceAll('\\', '/').split('/');
  const kept = segments.filter((segment) => segment !== '' && segment !== '.');
  const leadingSlash = path.startsWith('/') || path.startsWith('\\') ? '/' : '';
  return `${leadingSlash}${kept.join('/')}`;
}

/** An in-memory set of files, each tagged with the layer or module that owns it. */
export class VFS {
  readonly #entries = new Map<string, VfsEntry>();

  /** Adds a file, replacing any existing file at the same path. */
  set(path: string, content: string | Uint8Array, owner: string): void {
    this.#entries.set(normalizePath(path), { content, owner });
  }

  get(path: string): Readonly<VfsEntry> | undefined {
    return this.#entries.get(normalizePath(path));
  }

  has(path: string): boolean {
    return this.#entries.has(normalizePath(path));
  }

  /** All file paths, sorted by plain string comparison so the order is the same everywhere. */
  list(): string[] {
    return [...this.#entries.keys()].sort();
  }

  /** Removes a file. Does nothing if the path is not there. */
  delete(path: string): void {
    this.#entries.delete(normalizePath(path));
  }

  /**
   * Moves a file to a new path, keeping its content and owner and replacing any file already
   * at `to`. Does nothing if `from` is not there.
   */
  rename(from: string, to: string): void {
    const fromPath = normalizePath(from);
    const toPath = normalizePath(to);
    const entry = this.#entries.get(fromPath);
    if (entry === undefined || fromPath === toPath) {
      return;
    }
    this.#entries.delete(fromPath);
    this.#entries.set(toPath, entry);
  }
}