/**
 * Every post carrying one tag.
 */

import { Layout, type LayoutContext, type PageMeta } from './Layout.js';
import { html, type RawHtml } from '../html/html.js';
import type { Tag } from '../models/Tag.js';
import { renderPostList } from './partials.js';

/**
 * Every post carrying one tag.
 */
export class TagLayout extends Layout {
  /**
   * @param ctx - Configuration, path helpers, and the build timestamp.
   * @param tag - The tag whose posts this page lists.
   */
  constructor(
    ctx: LayoutContext,
    private readonly tag: Tag,
  ) {
    super(ctx);
  }

  /** "1 post" or "5 posts", used in both the metadata and the page body. */
  private get countLabel(): string {
    return `${this.tag.count} ${this.tag.count === 1 ? 'post' : 'posts'}`;
  }

  get meta(): PageMeta {
    return {
      title: this.tag.name,
      description: `${this.countLabel} tagged ${this.tag.name}.`,
      url: this.tag.url,
      ogType: 'website',
      publishedTime: null,
    };
  }

  protected renderMain(): RawHtml {
    return html`      <div class="archive">
        <h1 class="page-title">${this.tag.name}</h1>
        <p class="post-meta">${this.countLabel}</p>
        ${renderPostList(this.tag.posts)}
      </div>`;
  }
}
