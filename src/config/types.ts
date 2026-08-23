/**
 * Type definitions for the site configuration.
 *
 * @remarks
 * These types are the contract between `site.config.ts` (the single file a
 * human edits to re-brand the whole site) and the rest of the generator.
 * Everything is `readonly`: configuration is loaded once at startup and must
 * never be mutated during a build.
 */

/**
 * Which icon a {@link SocialLink} renders.
 *
 * @remarks
 * A closed union rather than a free string, so adding a link with no matching
 * icon is a compile-time error instead of a silently missing glyph.
 */
export type SocialKind = 'github' | 'linkedin' | 'scholar' | 'email' | 'x';

/** A brand or contact link rendered as an icon and label on the home page. */
export interface SocialLink {
  /** Which icon to render. */
  readonly kind: SocialKind;
  /** Visible text, such as a username or email address. */
  readonly label: string;
  /** Destination. Use a `mailto:` URL when {@link kind} is `'email'`. */
  readonly url: string;
}

/** A single entry in the header navigation bar. */
export interface NavItem {
  /** Visible text, e.g. `'Bio'`. */
  readonly label: string;
  /** Root-relative URL, e.g. `/bio.html`. The base path is applied for you. */
  readonly href: string;
}

/**
 * One `<link rel="icon">` entry.
 *
 * @remarks
 * List several to offer the browser a choice; it picks whichever suits the
 * surface it is drawing (tab, bookmark bar, home screen). A single scalable SVG
 * covers every size on its own, so a list is only needed for raster formats.
 *
 * Most browsers prefer an SVG when one is offered, so mixing an SVG with PNGs
 * usually means the PNGs are never used.
 */
export interface FaviconLink {
  /**
   * Where the icon lives. A root-relative path is served from this site and
   * picks up the base path automatically; an absolute URL is used untouched,
   * which is how you point at a CDN.
   */
  readonly url: string;
  /** MIME type, e.g. `'image/png'` or `'image/svg+xml'`. */
  readonly type: string;
  /**
   * Pixel dimensions, e.g. `'48x48'`. Use `null` for a scalable format, which
   * omits the attribute and lets the browser use it at any size.
   */
  readonly sizes: string | null;
}

/**
 * Shiki theme names used for build-time syntax highlighting.
 *
 * @remarks
 * Both are baked into every code block at once, as CSS custom properties, so
 * switching colour scheme in the browser needs no re-highlighting and no
 * JavaScript beyond flipping one attribute on `<html>`.
 */
export interface CodeThemes {
  /** Theme applied in light mode, e.g. `'github-light'`. */
  readonly light: string;
  /** Theme applied in dark mode, e.g. `'github-dark'`. */
  readonly dark: string;
}

/**
 * The complete site configuration.
 *
 * @remarks
 * Paths are relative to the repository root and are resolved to absolute paths
 * by `SitePaths`, so no other module has to think about the current working
 * directory.
 */
export interface SiteConfig {
  /** Site title: used in `<title>`, Open Graph tags, and the home page `<h1>`. */
  readonly title: string;
  /** Author name: used in structured metadata and the footer copyright line. */
  readonly author: string;
  /** One-line description for `<meta name="description">` and Open Graph. */
  readonly description: string;

  /**
   * Canonical origin with no trailing slash, e.g. `https://ps.github.io`.
   *
   * @remarks
   * Used to build absolute URLs for metadata and the RSS feed.
   */
  readonly url: string;

  /**
   * Subdirectory the site is served from, or `''` when served from the domain
   * root.
   *
   * @remarks
   * GitHub Pages serves a repository named `<username>.github.io` at the domain
   * root, where this must stay `''`. Any *other* repository name is served at
   * `https://<username>.github.io/<repo>/`, and this must then be set to
   * `'/<repo>'` or every root-relative URL on the site will 404.
   *
   * @example
   * ```ts
   * basePath: ''            // https://ps.github.io/
   * basePath: '/my-blog'    // https://ps.github.io/my-blog/
   * ```
   */
  readonly basePath: string;

  /** BCP-47 language tag for `<html lang>`, e.g. `'en'`. */
  readonly lang: string;
  /** First year shown in the footer copyright range. */
  readonly copyrightStartYear: number;

  /** Header navigation entries, rendered left to right. */
  readonly nav: readonly NavItem[];
  /** Contact and profile links shown on the home page. */
  readonly social: readonly SocialLink[];

  /** URL prefix for generated post pages, no trailing slash, e.g. `/blog`. */
  readonly postsBasePath: string;
  /** URL prefix for generated tag pages, no trailing slash, e.g. `/tags`. */
  readonly tagsBasePath: string;

  /** Directory holding markdown content; `pages/` and `posts/` live inside. */
  readonly contentDir: string;
  /** Directory of static files copied verbatim into the output. */
  readonly assetsDir: string;
  /** Directory the built site is written to. Cleared at the start of a build. */
  readonly outputDir: string;

  /**
   * Google Fonts stylesheet URL, or `null` to ship no external requests at all
   * and fall back to the system font stack in `style.css`.
   */
  readonly googleFontsHref: string | null;

  /**
   * Browser tab icons, rendered in the order given.
   *
   * @remarks
   * An empty array emits no icon link at all, in which case browsers fall back
   * to requesting `/favicon.ico`.
   */
  readonly favicons: readonly FaviconLink[];

  /** Syntax highlighting themes for light and dark mode. */
  readonly codeThemes: CodeThemes;
}
