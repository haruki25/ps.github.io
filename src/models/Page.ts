/**
 * A standalone page such as the bio - content with no date, no tags, and no
 * place in the chronological archive.
 */

import { Content, type ContentInit } from './Content.js';

/**
 * Constructor arguments for a {@link Page}.
 *
 * @remarks
 * Identical to {@link ContentInit} today. Kept as its own named type so that a
 * page-only field can be added later without changing any call site.
 */
export type PageInit = ContentInit;

/**
 * A dateless, untagged page.
 *
 * @remarks
 * `Page` adds no fields beyond {@link Content}. It exists as its own type
 * anyway, because the distinction is real and load-bearing: the archive lists
 * posts and never pages, the RSS feed carries posts and never pages, and having
 * separate types means the compiler enforces that rather than relying on every
 * call site to filter correctly.
 */
export class Page extends Content {
  /**
   * @param init - Title, slug, URL, rendered body, and source path.
   */
  constructor(init: PageInit) {
    super(init);
  }
}
