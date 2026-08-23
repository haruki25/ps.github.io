/**
 * A dated blog post: the only content type that is archived, tagged, and
 * syndicated.
 */

import { Content, type ContentInit } from './Content.js';
import {
  formatNumericDate,
  formatShortDate,
  toIsoString,
  utcYear,
} from '../util/dates.js';

/** Constructor arguments for a {@link Post}. */
export interface PostInit extends ContentInit {
  /** Publication date, parsed from the `date:` front matter field. */
  readonly date: Date;
  /** Tag names as written by the author, preserving their original casing. */
  readonly tags: readonly string[];
  /**
   * Short summary for metadata and the RSS feed, or `null` when the post sets
   * no `description:` and callers should fall back to the site description.
   */
  readonly description: string | null;
}

/**
 * One blog post.
 *
 * @remarks
 * All date accessors work in UTC, so a post's year and displayed date do not
 * shift with the timezone of whichever machine runs the build.
 */
export class Post extends Content {
  /** Publication date. */
  readonly date: Date;

  /** Tag names as written by the author. */
  readonly tags: readonly string[];

  /** Explicit summary from front matter, or `null` if none was given. */
  readonly description: string | null;

  /**
   * @param init - Content fields plus date, tags, and description.
   */
  constructor(init: PostInit) {
    super(init);
    this.date = init.date;
    this.tags = init.tags;
    this.description = init.description;
  }

  /** Publication year in UTC, used to group the archive listing. */
  get year(): number {
    return utcYear(this.date);
  }

  /** Machine-readable timestamp for the `<time datetime="...">` attribute. */
  get isoDate(): string {
    return toIsoString(this.date);
  }

  /** Visible date on the post page itself, e.g. `2026-08-23`. */
  get displayDate(): string {
    return formatNumericDate(this.date);
  }

  /** Visible date in the archive listing, e.g. `Aug 23`. */
  get shortDate(): string {
    return formatShortDate(this.date);
  }

  /**
   * Case-insensitive tag membership test.
   *
   * @param tagName - The tag to look for, in any casing.
   * @returns `true` if this post carries that tag.
   */
  hasTag(tagName: string): boolean {
    const needle = tagName.toLowerCase();
    return this.tags.some((tag) => tag.toLowerCase() === needle);
  }

  /**
   * Comparator that orders posts newest-first.
   *
   * @remarks
   * Exposed as a static so every listing sorts identically:
   * `posts.sort(Post.byNewestFirst)`.
   *
   * @param a - First post.
   * @param b - Second post.
   * @returns Negative if `a` is newer, positive if `b` is newer, zero if equal.
   */
  static byNewestFirst(a: Post, b: Post): number {
    return b.date.getTime() - a.date.getTime();
  }
}
