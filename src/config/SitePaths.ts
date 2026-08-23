/**
 * Every filesystem path and public URL the site uses, in one class.
 *
 * @remarks
 * The point of this class is that **no other module builds a path by string
 * concatenation**. If you ever want posts at `/writing/<slug>/` instead of
 * `/blog/<slug>.html`, you change the two methods here and nothing else - the
 * layouts, the archive listing, and the tag pages all keep working, because
 * they only ever ask {@link SitePaths.postUrl}.
 *
 * It also isolates the two genuinely fiddly details in a static site generator:
 *
 * 1. A *URL* always uses forward slashes, while an *output file path* must use
 *    the host OS separator. Mixing those up produces a site that builds fine on
 *    macOS and emits broken nested folders on Windows.
 * 2. When the site is served from a subdirectory rather than a domain root,
 *    every public URL needs a prefix but no output path does. See
 *    {@link SiteConfig.basePath}.
 */

import path from 'node:path';
import type { SiteConfig } from './types.js';
import { slugify } from '../util/slug.js';

/**
 * Resolves every input directory, output file, and public URL the site uses.
 *
 * @remarks
 * The single source of truth for the site's URL shape. Changing where posts
 * live is a two-method edit here, not a search-and-replace across the layouts.
 */
export class SitePaths {
  /** Absolute path to the repository root. */
  readonly rootDir: string;

  /**
   * The URL prefix, normalised to either `''` or `/segment` with no trailing
   * slash, so the join logic below never has to consider variants.
   */
  private readonly base: string;

  /**
   * @param config - The site configuration.
   * @param rootDir - Repository root; relative config paths resolve against it.
   */
  constructor(
    private readonly config: SiteConfig,
    rootDir: string,
  ) {
    this.rootDir = path.resolve(rootDir);
    this.base = SitePaths.normaliseBasePath(config.basePath);
  }

  /**
   * Reduce any spelling of a base path to a canonical one.
   *
   * @param basePath - Raw value from configuration, e.g. `'repo/'` or `'/repo'`.
   * @returns Either the empty string or `/segment` with no trailing slash.
   */
  private static normaliseBasePath(basePath: string): string {
    const trimmed = basePath.trim().replace(/^\/+|\/+$/g, '');
    return trimmed === '' ? '' : `/${trimmed}`;
  }

  /**
   * Prefix a root-relative URL with the configured base path.
   *
   * @param url - A root-relative URL beginning with `/`.
   * @returns The public URL a browser should request.
   */
  private withBase(url: string): string {
    if (this.base === '') return url;
    return url === '/' ? `${this.base}/` : `${this.base}${url}`;
  }

  /**
   * Remove the base path prefix from a URL.
   *
   * @remarks
   * Output files are written relative to the output directory, which maps to
   * the *served root*. Without stripping the prefix first, a site with
   * `basePath: '/repo'` would emit `dist/repo/blog/x.html` and every page would
   * end up one level too deep.
   *
   * @param url - A public URL, possibly carrying the base path.
   * @returns The same URL relative to the served root.
   */
  private withoutBase(url: string): string {
    if (this.base === '' || !url.startsWith(this.base)) return url;
    const stripped = url.slice(this.base.length);
    return stripped === '' ? '/' : stripped;
  }

  // --- Input directories ----------------------------------------------------

  /** Absolute path to the content directory. */
  get contentDir(): string {
    return path.resolve(this.rootDir, this.config.contentDir);
  }

  /** Absolute path to `content/posts/` - one markdown file per blog post. */
  get postsDir(): string {
    return path.join(this.contentDir, 'posts');
  }

  /** Absolute path to `content/pages/` - standalone pages such as the bio. */
  get pagesDir(): string {
    return path.join(this.contentDir, 'pages');
  }

  /** Absolute path to the static assets directory, copied verbatim. */
  get assetsDir(): string {
    return path.resolve(this.rootDir, this.config.assetsDir);
  }

  // --- Output directory -----------------------------------------------------

  /** Absolute path to the build output directory. Cleared on every build. */
  get outputDir(): string {
    return path.resolve(this.rootDir, this.config.outputDir);
  }

  /**
   * Translate a public URL into the absolute file it is written to.
   *
   * @param url - A public URL, e.g. `/blog/hello.html`.
   * @returns Absolute output path using native separators. A URL ending in `/`
   *   maps to `index.html` inside that folder.
   */
  outputFileFor(url: string): string {
    const rootRelative = this.withoutBase(url);
    const trimmed = rootRelative.replace(/^\/+/, '');
    const relative =
      trimmed === '' || trimmed.endsWith('/') ? `${trimmed}index.html` : trimmed;
    // Split on the URL separator and rejoin with the platform separator.
    return path.join(this.outputDir, ...relative.split('/'));
  }

  // --- Public URLs ----------------------------------------------------------

  /** The home page. */
  get homeUrl(): string {
    return this.withBase('/');
  }

  /**
   * A standalone page.
   *
   * @param slug - The page slug, e.g. `'bio'`.
   * @returns Its public URL, e.g. `/bio.html`.
   */
  pageUrl(slug: string): string {
    return this.withBase(`/${slug}.html`);
  }

  /**
   * A blog post.
   *
   * @param slug - The post slug, e.g. `'hello-world'`.
   * @returns Its public URL, e.g. `/blog/hello-world.html`.
   */
  postUrl(slug: string): string {
    return this.withBase(`${this.config.postsBasePath}/${slug}.html`);
  }

  /** The year-grouped archive listing. */
  get blogUrl(): string {
    // Derived from the same setting as postUrl, so the index and the posts it
    // lists can never end up under different prefixes. The trailing slash makes
    // this a directory index: /blog/ alongside /blog/hello-world.html.
    return this.withBase(`${this.config.postsBasePath}/`);
  }

  /** The index of all tags. */
  get tagIndexUrl(): string {
    return this.withBase('/tags.html');
  }

  /**
   * The page listing every post carrying one tag.
   *
   * @param tagName - The tag's display name, e.g. `'Machine Learning'`.
   * @returns Its public URL, slugified, e.g. `/tags/machine-learning.html`.
   */
  tagUrl(tagName: string): string {
    return this.withBase(`${this.config.tagsBasePath}/${slugify(tagName)}.html`);
  }

  /** The RSS feed. */
  get feedUrl(): string {
    return this.withBase('/feed.xml');
  }

  /**
   * A file copied verbatim from the assets directory.
   *
   * @param assetPath - Path within the assets directory, e.g. `/css/style.css`.
   * @returns Its public URL, base path included.
   */
  assetUrl(assetPath: string): string {
    // An absolute or protocol-relative URL points somewhere else entirely, so
    // the base path must not be glued onto the front of it. Without this,
    // configuring a CDN-hosted favicon would produce
    // "/ps.github.io/https://cdn.example.com/icon.png".
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(assetPath)) return assetPath;

    return this.withBase(
      assetPath.startsWith('/') ? assetPath : `/${assetPath}`,
    );
  }

  /**
   * Promote a public URL to an absolute one using the configured origin.
   *
   * @remarks
   * Required for Open Graph tags and RSS, which both reject relative URLs.
   *
   * @param url - A public URL, base path already applied.
   * @returns A fully qualified URL.
   */
  absoluteUrl(url: string): string {
    const origin = this.config.url.replace(/\/+$/, '');
    return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
  }
}
