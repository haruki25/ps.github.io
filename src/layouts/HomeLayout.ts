/**
 * The home page: name, contact links, and a short introduction.
 *
 * The prose comes from `content/pages/home.md`, so editing the introduction
 * never means opening a `.ts` file. The contact row comes from
 * `site.config.ts`. Between them, this layout contributes only arrangement.
 */

import { Layout, type LayoutContext, type PageMeta } from './Layout.js';
import { html, raw, type RawHtml } from '../html/html.js';
import { renderIcon } from '../html/icons.js';
import type { Page } from '../models/Page.js';

/**
 * The site root: name, contact row, and introduction.
 *
 * @remarks
 * Contributes only arrangement. The prose comes from `content/pages/home.md`
 * and the links from `site.config.ts`.
 */
export class HomeLayout extends Layout {
  /**
   * @param ctx - Configuration, path helpers, and the build timestamp.
   * @param page - The rendered `home.md` page supplying the introduction.
   */
  constructor(
    ctx: LayoutContext,
    private readonly page: Page,
  ) {
    super(ctx);
  }

  get meta(): PageMeta {
    return {
      // The home page title is the site title alone; `documentTitle` avoids
      // rendering it twice.
      title: this.ctx.config.title,
      description: this.ctx.config.description,
      url: this.ctx.paths.homeUrl,
      ogType: 'website',
      publishedTime: null,
    };
  }

  protected override get requiresMathStyles(): boolean {
    return Layout.containsMath(this.page.bodyHtml);
  }

  protected renderMain(): RawHtml {
    return html`      <article class="article article-home">
        <h1 class="page-title">${this.ctx.config.title}</h1>
        ${this.renderContactRow()}
        <div class="article-body">
${raw(this.page.bodyHtml)}
        </div>
      </article>`;
  }

  /**
   * The row of icon + label links.
   *
   * Each link carries an `aria-label` naming the service, because the visible
   * label is a username or address that does not say what it is on its own.
   */
  private renderContactRow(): RawHtml {
    const { social } = this.ctx.config;
    if (social.length === 0) return html``;

    return html`<p class="contact-row">
          ${social.map(
            (link) => html`<a class="contact-link" href="${link.url}" aria-label="${link.kind}">${renderIcon(link.kind)}<span>${link.label}</span></a>`,
          )}
        </p>`;
  }
}
