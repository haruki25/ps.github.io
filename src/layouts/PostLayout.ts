/**
 * A single blog post: title, date, body, and tags.
 */

import { Layout, type LayoutContext, type PageMeta } from './Layout.js';
import { html, raw, type RawHtml } from '../html/html.js';
import type { Post } from '../models/Post.js';
import type { Tag } from '../models/Tag.js';
import { renderPostTags } from './partials.js';
import { excerptFromHtml } from '../util/text.js';

/**
 * One blog post: title, date, body, and tags.
 */
export class PostLayout extends Layout {
  /**
   * @param ctx - Configuration, path helpers, and the build timestamp.
   * @param post - The post to render.
   * @param tags - The post's tags as resolved {@link Tag} objects, so each one
   *   can link to its listing page. The builder resolves these from the tag
   *   index; the post model itself only stores tag names.
   */
  constructor(
    ctx: LayoutContext,
    private readonly post: Post,
    private readonly tags: readonly Tag[],
  ) {
    super(ctx);
  }

  get meta(): PageMeta {
    // Prefer an explicit description, then a generated excerpt, then the
    // site-wide description as a last resort.
    const description =
      this.post.description ??
      excerptFromHtml(this.post.bodyHtml) ??
      this.ctx.config.description;

    return {
      title: this.post.title,
      description: description === '' ? this.ctx.config.description : description,
      url: this.post.url,
      ogType: 'article',
      publishedTime: this.post.isoDate,
    };
  }

  protected override get requiresMathStyles(): boolean {
    return Layout.containsMath(this.post.bodyHtml);
  }

  protected renderMain(): RawHtml {
    return html`      <article class="article">
        <h1 class="page-title">${this.post.title}</h1>
        <p class="post-meta">
          <time datetime="${this.post.isoDate}">${this.post.displayDate}</time>
        </p>
        <div class="article-body">
${raw(this.post.bodyHtml)}
        </div>
        ${renderPostTags(this.tags)}
      </article>`;
  }
}
