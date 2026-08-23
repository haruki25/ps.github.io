/**
 * A standalone page such as the bio: a title and a body, nothing else.
 *
 * This is the simplest possible subclass, and a good illustration of how
 * little a new page type has to supply once the shell lives in {@link Layout}.
 */

import { Layout, type LayoutContext, type PageMeta } from './Layout.js';
import { html, raw, type RawHtml } from '../html/html.js';
import type { Page } from '../models/Page.js';
import { excerptFromHtml } from '../util/text.js';

/**
 * A standalone page such as the bio: a title and a body.
 *
 * @remarks
 * The simplest subclass, and a good illustration of how little a new page type
 * has to supply once the shell lives in {@link Layout}.
 */
export class PageLayout extends Layout {
  /**
   * @param ctx - Configuration, path helpers, and the build timestamp.
   * @param page - The rendered page to display.
   */
  constructor(
    ctx: LayoutContext,
    private readonly page: Page,
  ) {
    super(ctx);
  }

  get meta(): PageMeta {
    return {
      title: this.page.title,
      // Fall back to a summary of the page itself rather than the generic site
      // description, which makes search results for the bio far more useful.
      description:
        excerptFromHtml(this.page.bodyHtml) || this.ctx.config.description,
      url: this.page.url,
      ogType: 'website',
      publishedTime: null,
    };
  }

  protected override get requiresMathStyles(): boolean {
    return Layout.containsMath(this.page.bodyHtml);
  }

  protected renderMain(): RawHtml {
    return html`      <article class="article">
        <h1 class="page-title">${this.page.title}</h1>
        <div class="article-body">
${raw(this.page.bodyHtml)}
        </div>
      </article>`;
  }
}
