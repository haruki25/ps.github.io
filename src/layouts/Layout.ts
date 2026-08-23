/**
 * The abstract base for every page type.
 *
 * @remarks
 * `Layout` owns the entire page *shell*: the `<head>`, the navigation bar, the
 * theme toggle, the footer, and the document scaffolding around them. A
 * subclass supplies only two things - the metadata for the `<head>` and the
 * markup that goes inside `<main>`. That is the whole extension point.
 *
 * The payoff is that a change to the shell happens exactly once. Adding a
 * `<meta>` tag, changing the nav markup, or adding a footer link updates every
 * page on the site without touching a single subclass.
 *
 * ```
 * Layout (abstract)
 * |-- HomeLayout        name, contact links, intro prose
 * |-- PageLayout        a standalone page such as the bio
 * |-- PostLayout        one blog post, with date and tags
 * |-- ArchiveLayout     all posts, grouped by year
 * |-- TagLayout         posts carrying one tag
 * `-- TagIndexLayout    every tag, with counts
 * ```
 */

import type { SiteConfig } from '../config/types.js';
import type { SitePaths } from '../config/SitePaths.js';
import { html, raw, render, type RawHtml } from '../html/html.js';
import {
  renderThemeInitScript,
  renderThemeToggle,
  renderThemeToggleScript,
} from '../html/theme.js';
import { formatCopyrightYears } from '../util/dates.js';

/** Shared collaborators handed to every layout. */
export interface LayoutContext {
  /** The site configuration. */
  readonly config: SiteConfig;
  /** Path and URL construction. */
  readonly paths: SitePaths;
  /** Fixed timestamp for the whole build, so every page agrees on "now". */
  readonly buildTime: Date;
}

/** What a subclass must declare about itself for the `<head>`. */
export interface PageMeta {
  /** Page title, without the site name; the base class appends that. */
  readonly title: string;
  /** Description for `<meta name="description">` and Open Graph. */
  readonly description: string;
  /** Public URL this page is published at, used for the canonical tag. */
  readonly url: string;
  /** Open Graph object type. */
  readonly ogType: 'website' | 'article';
  /** ISO timestamp for an article, or `null` for any other page type. */
  readonly publishedTime: string | null;
}

/**
 * Base class providing the shared page shell.
 *
 * @remarks
 * Subclass this to add a page type: implement {@link Layout.meta} and
 * `renderMain()`, then render it from the builder. Nothing else needs to change.
 */
export abstract class Layout {
  /**
   * @param ctx - Configuration, path helpers, and the build timestamp.
   */
  protected constructor(protected readonly ctx: LayoutContext) {}

  // --- The extension points a subclass must implement -----------------------

  /** Metadata describing this page. */
  abstract get meta(): PageMeta;

  /** The markup placed inside `<main>`. */
  protected abstract renderMain(): RawHtml;

  /**
   * Whether this page needs the KaTeX stylesheet.
   *
   * @remarks
   * Defaults to `false`; the content-bearing subclasses override it by looking
   * for rendered math in their body HTML. Pages without equations then avoid
   * loading a stylesheet and font files they would never use.
   */
  protected get requiresMathStyles(): boolean {
    return false;
  }

  // --- The shell, shared by every page -------------------------------------

  /**
   * Compose the complete HTML document.
   *
   * @remarks
   * This is the only public entry point; the builder calls it and writes the
   * result straight to disk.
   *
   * @returns The finished document, ready to write to a file.
   */
  render(): string {
    const document = html`<!DOCTYPE html>
<html lang="${this.ctx.config.lang}">
${this.renderHead()}
<body>
  <div class="container">
${this.renderHeader()}
    <main class="content">
${this.renderMain()}
    </main>
${this.renderFooter()}
  </div>
  ${renderThemeToggleScript()}
</body>
</html>
`;
    return render(document);
  }

  /**
   * The full document title.
   *
   * @returns `"Post Title - Site Name"`, or just the site name on the home
   *   page, where repeating it would be redundant.
   */
  protected get documentTitle(): string {
    const { title } = this.meta;
    const siteTitle = this.ctx.config.title;
    return title === siteTitle ? siteTitle : `${title} - ${siteTitle}`;
  }

  /**
   * The document `<head>`.
   *
   * @remarks
   * The theme script comes first, before the stylesheet, because it must apply
   * a stored colour scheme before the browser paints anything.
   *
   * @returns The `<head>` element.
   */
  protected renderHead(): RawHtml {
    const { config, paths } = this.ctx;
    const meta = this.meta;
    const canonical = paths.absoluteUrl(meta.url);

    return html`<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${renderThemeInitScript()}
  <title>${this.documentTitle}</title>
  <meta name="description" content="${meta.description}">
  <link rel="canonical" href="${canonical}">
  <meta name="color-scheme" content="light dark">

  <meta property="og:type" content="${meta.ogType}">
  <meta property="og:title" content="${meta.title}">
  <meta property="og:description" content="${meta.description}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="${config.title}">
  <meta property="og:locale" content="${config.lang}">
  <meta name="twitter:card" content="summary">
  ${meta.publishedTime !== null &&
  html`<meta property="article:published_time" content="${meta.publishedTime}">
  <meta property="article:author" content="${config.author}">`}

  <link rel="icon" href="${paths.assetUrl('/favicon.svg')}" type="image/svg+xml">
  <link rel="alternate" type="application/rss+xml" title="${config.title}" href="${paths.feedUrl}">
  ${config.googleFontsHref !== null &&
  html`<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${config.googleFontsHref}">`}
  ${this.requiresMathStyles &&
  html`<link rel="stylesheet" href="${paths.assetUrl('/vendor/katex/katex.min.css')}">`}
  <link rel="stylesheet" href="${paths.assetUrl('/css/style.css')}">
</head>`;
  }

  /**
   * The site header: navigation on the left, theme toggle on the right.
   *
   * @returns The `<header>` element.
   */
  protected renderHeader(): RawHtml {
    const { nav } = this.ctx.config;

    return html`    <header class="site-header">
      <nav class="nav" aria-label="Main">
        ${nav.map((item) => this.renderNavLink(item.href, item.label))}
      </nav>
      ${renderThemeToggle()}
    </header>`;
  }

  /**
   * One navigation link, marked active when it represents the current section.
   *
   * @remarks
   * The home link matches only the home page exactly. Other links also match
   * their descendant pages, so an individual post keeps "Blog" lit.
   *
   * @param href - The link's configured destination.
   * @param label - Its visible text.
   * @returns An `<a>` element.
   */
  private renderNavLink(href: string, label: string): RawHtml {
    const { paths, config } = this.ctx;
    const currentUrl = this.meta.url;
    const target = paths.assetUrl(href);

    const isPostPage = currentUrl.startsWith(
      paths.assetUrl(`${config.postsBasePath}/`),
    );
    const isActive =
      target === paths.homeUrl
        ? currentUrl === paths.homeUrl
        : currentUrl === target ||
          (isPostPage && target === paths.archiveUrl);

    return html`<a class="nav-link${isActive ? ' is-active' : ''}" href="${target}"${
      isActive ? raw(' aria-current="page"') : ''
    }>${label}</a>`;
  }

  /**
   * The site footer.
   *
   * @returns The `<footer>` element.
   */
  protected renderFooter(): RawHtml {
    const { config, buildTime } = this.ctx;
    const years = formatCopyrightYears(config.copyrightStartYear, buildTime);

    return html`    <footer class="site-footer">
      <p>&copy; ${years} ${config.author}</p>
    </footer>`;
  }

  /**
   * Helper for subclasses: does this HTML contain rendered math?
   *
   * @remarks
   * KaTeX always emits an element with the `katex` class, so its presence is a
   * reliable signal that the stylesheet is needed.
   *
   * @param bodyHtml - Rendered article HTML.
   * @returns `true` when the KaTeX stylesheet should be loaded.
   */
  protected static containsMath(bodyHtml: string): boolean {
    return bodyHtml.includes('class="katex');
  }
}
