/**
 * The blog index: every post, grouped under a heading for its year.
 */

import { Layout, type LayoutContext, type PageMeta } from './Layout.js';
import { html, type RawHtml } from '../html/html.js';
import type { Post } from '../models/Post.js';
import { renderPostListItem } from './partials.js';

/** One year's worth of posts. */
interface YearGroup {
  readonly year: number;
  readonly posts: readonly Post[];
}

/**
 * The blog index: every post, grouped under a heading for its year.
 */
export class ArchiveLayout extends Layout {
  /**
   * @param ctx - Configuration, path helpers, and the build timestamp.
   * @param posts - Every published post, ordered newest-first.
   */
  constructor(
    ctx: LayoutContext,
    private readonly posts: readonly Post[],
  ) {
    super(ctx);
  }

  get meta(): PageMeta {
    return {
      title: 'Blog',
      description: `Writing by ${this.ctx.config.author}.`,
      url: this.ctx.paths.blogUrl,
      ogType: 'website',
      publishedTime: null,
    };
  }

  protected renderMain(): RawHtml {
    const groups = this.groupByYear();

    return html`      <div class="archive">
        <h1 class="page-title">Blog</h1>
        ${groups.length === 0
          ? html`<p class="empty-note">No posts yet.</p>`
          : groups.map(
              (group) => html`<section class="archive-year">
          <h2 class="archive-year-title">${group.year}</h2>
          <ul class="post-list">
        ${group.posts.map(renderPostListItem)}
          </ul>
        </section>`,
            )}
      </div>`;
  }

  /**
   * Bucket the posts by year, newest year first.
   *
   * The posts arrive already sorted newest-first, so insertion order within
   * each bucket is correct and needs no second sort.
   */
  private groupByYear(): YearGroup[] {
    const buckets = new Map<number, Post[]>();

    for (const post of this.posts) {
      const existing = buckets.get(post.year);
      if (existing) {
        existing.push(post);
      } else {
        buckets.set(post.year, [post]);
      }
    }

    return [...buckets.entries()]
      .map(([year, posts]) => ({ year, posts }))
      .sort((a, b) => b.year - a.year);
  }
}
