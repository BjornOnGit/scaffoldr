/** Every failure `core` can report, as a stable code the CLI and other callers can switch on. */
export const errorCodes = [
  'INVALID_CONFIG',
  'UNKNOWN_BLUEPRINT',
  'UNKNOWN_LAYER',
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
] as const;

export type ErrorCode = (typeof errorCodes)[number];

export interface ScaffoldrErrorOptions {
  /** A short suggestion for how to fix the problem, shown after the message. */
  hint?: string;
  /** Structured context, such as the offending module id or file path. */
  details?: Record<string, unknown>;
}

/** The only error type `core` throws on purpose. */
export class ScaffoldrError extends Error {
  readonly code: ErrorCode;
  readonly hint?: string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options: ScaffoldrErrorOptions = {},
  ) {
    super(message);
    this.name = 'ScaffoldrError';
    this.code = code;
    this.hint = options.hint;
    this.details = options.details;
  }
}
