/**
 * RSS 2.0 feed generation.
 *
 * Kept deliberately small and dependency-free: a feed is a handful of elements
 * and a date format, and pulling in a library to emit thirty lines of XML would
 * be more code to understand, not less.
 */

import type { SiteConfig } from '../config/types.js';
import type { SitePaths } from '../config/SitePaths.js';
import type { Post } from '../models/Post.js';
import { excerptFromHtml } from '../util/text.js';

/** How many posts the feed carries. Older posts remain on the site. */
const MAX_FEED_ITEMS = 20;

/**
 * Escape text for inclusion in an XML text node or attribute.
 *
 * Note this is *not* the same function as the HTML escaper: XML has no named
 * entities beyond the five predefined ones, so `&nbsp;` would be a hard parse
 * error in a feed reader rather than a rendering quirk.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Renders the site's RSS 2.0 feed.
 *
 * @remarks
 * Dependency-free by choice: a feed is a handful of elements and a date format,
 * and pulling in a library to emit thirty lines of XML would be more code to
 * understand, not less.
 */
export class FeedGenerator {
  /**
   * @param config - Site title, description, and language.
   * @param paths - Used to build absolute URLs, which RSS requires.
   */
  constructor(
    private readonly config: SiteConfig,
    private readonly paths: SitePaths,
  ) {}

  /**
   * Render the complete feed document.
   *
   * @param posts All posts, newest first.
   * @param buildTime Timestamp used for `lastBuildDate`.
   */
  render(posts: readonly Post[], buildTime: Date): string {
    const items = posts
      .slice(0, MAX_FEED_ITEMS)
      .map((post) => this.renderItem(post))
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(this.config.title)}</title>
    <link>${escapeXml(this.paths.absoluteUrl('/'))}</link>
    <description>${escapeXml(this.config.description)}</description>
    <language>${escapeXml(this.config.lang)}</language>
    <lastBuildDate>${buildTime.toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(
      this.paths.absoluteUrl(this.paths.feedUrl),
    )}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
  }

  /**
   * One `<item>`.
   *
   * The description carries a short plain-text summary rather than the full
   * article body: it keeps the feed small, and it means a reader that strips
   * HTML still shows something sensible.
   */
  private renderItem(post: Post): string {
    const url = this.paths.absoluteUrl(post.url);
    const summary = post.description ?? excerptFromHtml(post.bodyHtml, 300);

    const categories = post.tags
      .map((tag) => `      <category>${escapeXml(tag)}</category>`)
      .join('\n');

    return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${post.date.toUTCString()}</pubDate>
      <description>${escapeXml(summary)}</description>${
        categories === '' ? '' : `\n${categories}`
      }
    </item>`;
  }
}
