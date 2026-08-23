/**
 * Markup fragments shared by more than one layout.
 *
 * Anything that appears on two pages lives here rather than being duplicated
 * into both layouts. The archive listing and each tag page, for example, render
 * post entries identically - so they share one function, and a change to how a
 * post entry looks happens in exactly one place.
 */

import { html, type RawHtml } from '../html/html.js';
import type { Post } from '../models/Post.js';
import type { Tag } from '../models/Tag.js';

/**
 * One row in a list of posts: a short date beside a linked title.
 *
 * The date is a `<time>` element carrying a machine-readable `datetime`, so the
 * listing stays meaningful to feed readers and search engines.
 */
export function renderPostListItem(post: Post): RawHtml {
  return html`<li class="post-item">
          <time class="post-item-date" datetime="${post.isoDate}">${post.shortDate}</time>
          <a class="post-item-title" href="${post.url}">${post.title}</a>
        </li>`;
}

/** A list of posts, or a short note when there are none. */
export function renderPostList(posts: readonly Post[]): RawHtml {
  if (posts.length === 0) {
    return html`<p class="empty-note">No posts yet.</p>`;
  }
  return html`<ul class="post-list">
        ${posts.map(renderPostListItem)}
      </ul>`;
}

/**
 * The inline tag row shown beneath a post.
 * Renders nothing at all when the post is untagged.
 */
export function renderPostTags(tags: readonly Tag[]): RawHtml {
  if (tags.length === 0) return html``;
  return html`<p class="post-tags">
        ${tags.map(
          (tag) => html`<a class="tag" href="${tag.url}">${tag.name}</a>`,
        )}
      </p>`;
}
