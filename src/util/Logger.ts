/**
 * Console output for the build.
 *
 * Exists so that no other module calls `console.log` directly. That keeps the
 * output format consistent, makes it trivial to silence during tests, and
 * means colour handling is decided once rather than at every call site.
 */

/** ANSI escape codes, applied only when the terminal will actually render them. */
const CODES = {
  reset: '[0m',
  dim: '[2m',
  red: '[31m',
  green: '[32m',
  yellow: '[33m',
  cyan: '[36m',
} as const;

/**
 * Whether to emit colour.
 *
 * Respects the NO_COLOR convention (https://no-color.org) and falls back to
 * plain text when output is redirected to a file or a CI log.
 */
function supportsColor(): boolean {
  if (process.env['NO_COLOR'] !== undefined) return false;
  if (process.env['FORCE_COLOR'] !== undefined) return true;
  return process.stdout.isTTY === true;
}

/**
 * Formatted console output for the build.
 *
 * @remarks
 * Also accumulates every warning it prints, so a build can end with a count
 * instead of leaving problems scrolled off the top of the terminal.
 */
export class Logger {
  /** Whether ANSI colour is emitted, decided once at construction. */
  private readonly color: boolean;

  /** Warnings collected during the run, for the closing summary. */
  private readonly warnings: string[] = [];

  /**
   * @param quiet - Suppress progress output. Warnings and errors still print,
   *   because silencing those would hide real problems.
   */
  constructor(private readonly quiet = false) {
    this.color = supportsColor();
  }

  /** Wrap text in an ANSI colour, or return it unchanged when colour is off. */
  private paint(code: string, text: string): string {
    return this.color ? `${code}${text}${CODES.reset}` : text;
  }

  /** A normal progress line. */
  info(message: string): void {
    if (this.quiet) return;
    console.log(message);
  }

  /** Secondary detail, shown dimmed. */
  detail(message: string): void {
    if (this.quiet) return;
    console.log(this.paint(CODES.dim, `  ${message}`));
  }

  /** A step that completed successfully. */
  success(message: string): void {
    if (this.quiet) return;
    console.log(`${this.paint(CODES.green, '✓')} ${message}`);
  }

  /**
   * A non-fatal problem. Recorded as well as printed, so the build can end with
   * a count rather than leaving warnings scrolled off the top of the terminal.
   */
  warn(message: string): void {
    this.warnings.push(message);
    console.warn(`${this.paint(CODES.yellow, '!')} ${message}`);
  }

  /** A fatal problem. */
  error(message: string): void {
    console.error(`${this.paint(CODES.red, '✗')} ${message}`);
  }

  /** Highlighted text for use inside another message. */
  emphasise(text: string): string {
    return this.paint(CODES.cyan, text);
  }

  /** Everything passed to {@link warn} during this run. */
  get collectedWarnings(): readonly string[] {
    return this.warnings;
  }
}
