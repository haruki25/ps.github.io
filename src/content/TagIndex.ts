/**
 * Derives the site's tag structure from its posts.
 *
 * Tags are never authored directly - there is no list to keep in sync. Adding
 * `tags: [TypeScript]` to a post's front matter is enough to bring a tag page
 * into existence, and removing the last post carrying a tag makes its page go
 * away again.
 *
 * Grouping is case-insensitive so that `TypeScript` and `typescript` collapse
 * into one tag, but the display name keeps the casing of whichever post
 * introduced it first (posts are supplied newest-first, so that is the most
 * recent spelling).
 */

import type { SitePaths } from '../config/SitePaths.js';
import type { Post } from '../models/Post.js';
import { Tag } from '../models/Tag.js';

/**
 * The site's tag structure, derived from its posts.
 *
 * @remarks
 * Built once per build and then read-only. Grouping is case-insensitive, so
 * `TypeScript` and `typescript` collapse into a single tag.
 */
export class TagIndex {
  /** Every tag, sorted alphabetically. */
  readonly all: readonly Tag[];

  /** Lookup by lowercased tag name, backing {@link find}. */
  private readonly byName: ReadonlyMap<string, Tag>;

  /**
   * @param posts - Every published post, ordered newest-first. The ordering is
   *   carried through into each tag's post list.
   * @param paths - Used to build each tag's listing URL.
   */
  constructor(posts: readonly Post[], paths: SitePaths) {
    // Accumulate posts per tag, keyed case-insensitively but remembering the
    // display spelling from the first post that used it.
    const groups = new Map<string, { display: string; posts: Post[] }>();

    for (const post of posts) {
      for (const tagName of post.tags) {
        const key = tagName.toLowerCase();
        const existing = groups.get(key);
        if (existing) {
          existing.posts.push(post);
        } else {
          groups.set(key, { display: tagName, posts: [post] });
        }
      }
    }

    const tags = [...groups.values()]
      .map(
        (group) =>
          new Tag(group.display, paths.tagUrl(group.display), group.posts),
      )
      .sort(Tag.byName);

    this.all = tags;
    this.byName = new Map(tags.map((tag) => [tag.name.toLowerCase(), tag]));
  }

  /** Look up a tag by name, case-insensitively. */
  find(name: string): Tag | undefined {
    return this.byName.get(name.toLowerCase());
  }

  /** True when no post carries any tag, in which case tag pages are skipped. */
  get isEmpty(): boolean {
    return this.all.length === 0;
  }
}
