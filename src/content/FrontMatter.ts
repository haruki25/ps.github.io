/**
 * Reading and validating the YAML front matter at the top of a markdown file.
 *
 * The job here is to fail *loudly and early*. A missing `title:` should stop
 * the build with a message naming the offending file, not quietly produce a
 * page whose heading says "undefined". Every accessor below either returns a
 * value of the promised type or throws {@link FrontMatterError}.
 */

import matter from 'gray-matter';

/**
 * A front matter problem, always carrying the file it came from.
 *
 * Extends `Error` properly (including the `setPrototypeOf` dance required when
 * targeting ES2022 class semantics from a transpiled subclass) so that
 * `instanceof FrontMatterError` works in the build's error handler.
 */
export class FrontMatterError extends Error {
  /**
   * @param sourcePath - Absolute path of the offending markdown file. Exposed
   *   as a property so a caller can report the file without parsing the message.
   * @param message - What was wrong, phrased for the author to act on.
   */
  constructor(
    readonly sourcePath: string,
    message: string,
  ) {
    super(`${sourcePath}: ${message}`);
    this.name = 'FrontMatterError';
    Object.setPrototypeOf(this, FrontMatterError.prototype);
  }
}

/** A markdown file split into its front matter and its body. */
export interface RawDocument {
  /** Parsed YAML front matter. Empty object when the file has none. */
  readonly data: Record<string, unknown>;
  /** The markdown body, with front matter removed. */
  readonly body: string;
  /** Absolute path of the source file, used in error messages. */
  readonly sourcePath: string;
}

/** Split a markdown file into front matter and body. */
export function parseDocument(
  sourcePath: string,
  fileContents: string,
): RawDocument {
  const parsed = matter(fileContents);
  return {
    data: parsed.data as Record<string, unknown>,
    body: parsed.content,
    sourcePath,
  };
}

/**
 * Typed, validating access to one document's front matter.
 *
 * Wrapping the raw object in a reader keeps the validation rules in one place
 * instead of scattering `typeof x === 'string'` checks through the repository.
 */
export class FrontMatterReader {
  /**
   * @param doc - The parsed document whose front matter will be read.
   */
  constructor(private readonly doc: RawDocument) {}

  /** The file this front matter came from. */
  get sourcePath(): string {
    return this.doc.sourcePath;
  }

  /** Throw a {@link FrontMatterError} naming this document. */
  private fail(message: string): never {
    throw new FrontMatterError(this.doc.sourcePath, message);
  }

  /** A required string field, e.g. `title`. Empty strings are rejected. */
  requireString(key: string): string {
    const value = this.doc.data[key];
    if (typeof value !== 'string' || value.trim() === '') {
      this.fail(`front matter is missing a non-empty "${key}:" field`);
    }
    return value.trim();
  }

  /** An optional string field. Returns `null` when absent or blank. */
  optionalString(key: string): string | null {
    const value = this.doc.data[key];
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') {
      this.fail(`"${key}:" must be a string, got ${typeof value}`);
    }
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }

  /**
   * A required date field.
   *
   * YAML parses an unquoted `2026-08-23` into a `Date` at UTC midnight, so that
   * is the common path. Quoted strings and full ISO timestamps are also
   * accepted, which keeps hand-written front matter forgiving.
   */
  requireDate(key: string): Date {
    const value = this.doc.data[key];

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        this.fail(`"${key}:" is not a valid date`);
      }
      return value;
    }

    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        this.fail(`"${key}:" is not a valid date: "${value}"`);
      }
      return parsed;
    }

    return this.fail(`front matter is missing a "${key}:" date field`);
  }

  /**
   * A list of strings, e.g. `tags`.
   *
   * Accepts a YAML list, a single bare string (treated as a one-element list),
   * or nothing at all (an empty list). Duplicates are removed case-insensitively
   * while preserving the casing of the first occurrence.
   */
  stringArray(key: string): string[] {
    const value = this.doc.data[key];
    if (value === undefined || value === null) return [];

    const items = Array.isArray(value) ? value : [value];
    const seen = new Set<string>();
    const result: string[] = [];

    for (const item of items) {
      if (typeof item !== 'string') {
        this.fail(`"${key}:" must contain only strings, found ${typeof item}`);
      }
      const trimmed = item.trim();
      if (trimmed === '') continue;

      const fingerprint = trimmed.toLowerCase();
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      result.push(trimmed);
    }

    return result;
  }

  /** A boolean field with a fallback, e.g. `draft`. */
  boolean(key: string, fallback: boolean): boolean {
    const value = this.doc.data[key];
    if (value === undefined || value === null) return fallback;
    if (typeof value !== 'boolean') {
      this.fail(`"${key}:" must be true or false, got ${typeof value}`);
    }
    return value;
  }
}
