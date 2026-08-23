/**
 * The index of every tag, with a count beside each.
 *
 * This page is generated even though it is not in the default navigation, so
 * that per-post tag links always lead somewhere and the page is ready the
 * moment you decide to surface it in `site.config.ts`.
 */

import { Layout, type LayoutContext, type PageMeta } from './Layout.js';
import { html, type RawHtml } from '../html/html.js';
import type { Tag } from '../models/Tag.js';

/**
 * The index of every tag, with a count beside each.
 *
 * @remarks
 * Generated even when not in the navigation, so per-post tag links always lead
 * somewhere and the page is ready the moment you surface it in the config.
 */
export class TagIndexLayout extends Layout {
  /**
   * @param ctx - Configuration, path helpers, and the build timestamp.
   * @param tags - Every tag on the site, sorted alphabetically.
   */
  constructor(
    ctx: LayoutContext,
    private readonly tags: readonly Tag[],
  ) {
    super(ctx);
  }

  get meta(): PageMeta {
    return {
      title: 'Tags',
      description: `All topics written about by ${this.ctx.config.author}.`,
      url: this.ctx.paths.tagIndexUrl,
      ogType: 'website',
      publishedTime: null,
    };
  }

  protected renderMain(): RawHtml {
    return html`      <div class="archive">
        <h1 class="page-title">Tags</h1>
        ${this.tags.length === 0
          ? html`<p class="empty-note">No tags yet.</p>`
          : html`<ul class="tag-list">
        ${this.tags.map(
          (tag) => html`<li><a class="tag" href="${tag.url}">${tag.name}</a><span class="tag-count">${tag.count}</span></li>`,
        )}
          </ul>`}
      </div>`;
  }
}
