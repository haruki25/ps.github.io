/**
 * A tag together with every post carrying it.
 */

import type { Post } from './Post.js';
import { slugify } from '../util/slug.js';

/**
 * One tag and its posts.
 *
 * @remarks
 * Tags are not authored anywhere - there is no `tags/` directory to maintain.
 * They are derived from the posts by the tag index, so writing
 * `tags: [TypeScript]` in a post's front matter is all it takes to bring a new
 * tag page into existence.
 */
export class Tag {
  /** Display name, using the casing from the first post that introduced it. */
  readonly name: string;

  /** URL-safe form of {@link Tag.name}. */
  readonly slug: string;

  /** Public URL of this tag's listing page. */
  readonly url: string;

  /** Posts carrying this tag, newest first. */
  readonly posts: readonly Post[];

  /**
   * @param name - Display name, casing preserved.
   * @param url - Public URL of the tag's listing page.
   * @param posts - Posts carrying this tag, already ordered newest-first.
   */
  constructor(name: string, url: string, posts: readonly Post[]) {
    this.name = name;
    this.slug = slugify(name);
    this.url = url;
    this.posts = posts;
  }

  /** How many posts carry this tag. */
  get count(): number {
    return this.posts.length;
  }

  /**
   * Alphabetical comparator, case-insensitive: `tags.sort(Tag.byName)`.
   *
   * @param a - First tag.
   * @param b - Second tag.
   * @returns Standard comparator ordering.
   */
  static byName(a: Tag, b: Tag): number {
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  }
}
