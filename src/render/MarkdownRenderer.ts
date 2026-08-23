/**
 * Markdown to HTML, with build-time math and syntax highlighting.
 *
 * @remarks
 * This class is the *only* place that knows markdown exists. Everything
 * downstream - models, layouts, the builder - deals in finished HTML strings.
 * That boundary is what makes it possible to swap markdown engines later
 * without touching a single layout.
 *
 * Construction is asynchronous because Shiki loads its grammars and themes from
 * disk, so use the {@link MarkdownRenderer.create} factory rather than `new`.
 */

import MarkdownIt from 'markdown-it';
import { bundledLanguages, createHighlighter, type Highlighter } from 'shiki';

import type { CodeThemes } from '../config/types.js';
import { createKatexPlugin } from './plugins/katex.js';

/** Options for {@link MarkdownRenderer.create}. */
export interface MarkdownRendererOptions {
  /** Shiki themes for light and dark colour schemes. */
  readonly codeThemes: CodeThemes;

  /**
   * Turns a root-relative URL written in markdown into a public one.
   *
   * @remarks
   * Authors write `[bio](/bio.html)` in their markdown, which is correct only
   * when the site is served from a domain root. This hook applies the
   * configured base path so those links keep working from a subdirectory.
   * Supply the identity function to leave links untouched.
   *
   * @param rootRelativeUrl - A URL beginning with a single `/`.
   * @returns The URL a browser should actually request.
   */
  readonly resolveUrl: (rootRelativeUrl: string) => string;

  /** Receives non-fatal problems, such as bad math or an unknown language. */
  readonly onWarning: (message: string) => void;
}

/**
 * Grammars loaded up front.
 *
 * @remarks
 * Anything else a post actually uses is loaded on demand by
 * {@link MarkdownRenderer.prepare}, so this list is a warm start rather than a
 * limit on what you can write.
 */
const PRELOADED_LANGUAGES = [
  'bash',
  'css',
  'html',
  'javascript',
  'json',
  'markdown',
  'python',
  'typescript',
] as const;

/** Matches the info string of a fenced code block, capturing the language. */
const FENCE_LANGUAGE_PATTERN = /^[ \t]*(?:```|~~~)[ \t]*([A-Za-z0-9_+#.-]+)/gm;

/**
 * Converts markdown to HTML, with math and syntax highlighting baked in at
 * build time.
 *
 * @remarks
 * Construct with {@link MarkdownRenderer.create}, not `new`: Shiki loads its
 * grammars asynchronously.
 */
export class MarkdownRenderer {
  /**
   * @param md - The configured markdown-it instance.
   * @param highlighter - A Shiki highlighter with both themes loaded.
   * @param options - The options this renderer was created with.
   */
  private constructor(
    private readonly md: MarkdownIt,
    private readonly highlighter: Highlighter,
    private readonly options: MarkdownRendererOptions,
  ) {}

  /**
   * Build a renderer with math, highlighting, and sensible typography enabled.
   *
   * @param options - Themes and a warning sink.
   * @returns A ready-to-use renderer.
   */
  static async create(
    options: MarkdownRendererOptions,
  ): Promise<MarkdownRenderer> {
    const highlighter = await createHighlighter({
      themes: [options.codeThemes.light, options.codeThemes.dark],
      langs: [...PRELOADED_LANGUAGES],
    });

    // `highlight` is declared here but delegates to the instance method below,
    // which needs `renderer` to exist first - hence the late binding via a
    // mutable reference. This is the one wrinkle of combining a synchronous
    // markdown-it callback with an async-constructed collaborator.
    let renderer: MarkdownRenderer | undefined;

    const md = new MarkdownIt({
      // Raw HTML in markdown is allowed: this is a single-author site and the
      // author is trusted. Never enable this for user-submitted content.
      html: true,
      // Turn bare URLs into links.
      linkify: true,
      // Smart quotes, em dashes, ellipses.
      typographer: true,
      highlight: (code, lang) => renderer?.highlight(code, lang) ?? '',
    });

    md.use(
      createKatexPlugin({
        onError: (expression, message) => {
          options.onWarning(`KaTeX could not render "${expression}": ${message}`);
        },
      }),
    );

    applyLinkRules(md, options.resolveUrl);

    renderer = new MarkdownRenderer(md, highlighter, options);
    return renderer;
  }

  /**
   * Load any code-fence languages used by the given sources.
   *
   * @remarks
   * Call this once with every markdown document before rendering any of them.
   * It exists because markdown-it's highlight hook is synchronous while Shiki's
   * grammar loading is not, so languages must be resolved in advance.
   *
   * @param sources - Every markdown body about to be rendered.
   */
  async prepare(sources: readonly string[]): Promise<void> {
    const wanted = new Set<string>();
    for (const source of sources) {
      for (const match of source.matchAll(FENCE_LANGUAGE_PATTERN)) {
        const language = match[1]?.toLowerCase();
        if (language) wanted.add(language);
      }
    }

    const loaded = new Set(this.highlighter.getLoadedLanguages());
    const missing = [...wanted].filter(
      (language) => !loaded.has(language) && language in bundledLanguages,
    );

    if (missing.length > 0) {
      await this.highlighter.loadLanguage(
        ...(missing as (keyof typeof bundledLanguages)[]),
      );
    }
  }

  /**
   * Release the syntax highlighter's resources.
   *
   * @remarks
   * Shiki holds compiled grammars and a WebAssembly regex engine, and it warns
   * once ten highlighters exist in a process. A one-shot build could ignore
   * that - the process is about to exit anyway - but the dev server builds
   * repeatedly in a single long-lived process, so an undisposed highlighter per
   * rebuild accumulates without bound.
   *
   * The renderer must not be used after this is called.
   */
  dispose(): void {
    this.highlighter.dispose();
  }

  /**
   * Render a full markdown document.
   *
   * @param markdown - The document body, front matter already removed.
   * @returns Finished HTML.
   */
  render(markdown: string): string {
    return this.md.render(markdown);
  }

  /**
   * Render markdown without wrapping it in a paragraph.
   *
   * @param markdown - A short fragment, such as a title containing emphasis.
   * @returns Finished inline HTML.
   */
  renderInline(markdown: string): string {
    return this.md.renderInline(markdown);
  }

  /**
   * Syntax-highlight one fenced code block.
   *
   * @remarks
   * Emits both themes at once as CSS custom properties (`--shiki-light` and
   * `--shiki-dark`) rather than committing to one. The stylesheet decides which
   * set applies, so switching colour scheme costs nothing at runtime.
   *
   * An unknown or absent language degrades to an unhighlighted block rather
   * than failing the build.
   *
   * @param code - The raw contents of the code block.
   * @param language - The fence's info string, possibly empty.
   * @returns A complete `<pre>` element; markdown-it skips its own wrapping.
   */
  private highlight(code: string, language: string): string {
    const requested = language.toLowerCase();
    const isLoaded = this.highlighter.getLoadedLanguages().includes(requested);

    if (requested !== '' && !isLoaded) {
      this.options.onWarning(
        `Unknown code language "${language}"; rendering it without highlighting.`,
      );
    }

    return this.highlighter.codeToHtml(code, {
      lang: isLoaded ? requested : 'text',
      themes: {
        light: this.options.codeThemes.light,
        dark: this.options.codeThemes.dark,
      },
      // Emit variables for both themes instead of inlining one theme's colours.
      defaultColor: false,
    });
  }
}

/**
 * Matches a URL that leaves the site: absolute, or protocol-relative.
 */
const EXTERNAL_URL_PATTERN = /^(https?:)?\/\//i;

/**
 * Matches a root-relative URL - a single leading slash, not two.
 *
 * @remarks
 * The negative lookahead is what keeps `//cdn.example.com/x.png` out: that is
 * protocol-relative and points off-site, despite starting with a slash.
 */
const ROOT_RELATIVE_URL_PATTERN = /^\/(?!\/)/;

/**
 * Rewrite links and images in rendered markdown.
 *
 * @remarks
 * Two jobs, both done here because by this point markdown-it has parsed the
 * document and knows exactly which tokens are links, so neither needs a regex
 * over the finished HTML:
 *
 * 1. Off-site links get `rel="noopener noreferrer"`.
 * 2. Root-relative links and image sources get the site's base path applied,
 *    so hand-written `[bio](/bio.html)` survives being served from a
 *    subdirectory.
 *
 * @param md - The markdown-it instance to modify in place.
 * @param resolveUrl - Applies the base path to a root-relative URL.
 */
function applyLinkRules(
  md: MarkdownIt,
  resolveUrl: (url: string) => string,
): void {
  /**
   * Rewrite one URL-bearing attribute on one token.
   *
   * @param token - The token to inspect, if present.
   * @param attribute - Which attribute holds the URL.
   * @param markExternal - Whether off-site URLs should get a `rel` attribute.
   */
  const rewrite = (
    token: { attrGet(n: string): string | null; attrSet(n: string, v: string): void } | undefined,
    attribute: string,
    markExternal: boolean,
  ): void => {
    if (!token) return;
    const url = token.attrGet(attribute);
    if (!url) return;

    if (EXTERNAL_URL_PATTERN.test(url)) {
      if (markExternal) token.attrSet('rel', 'noopener noreferrer');
      return;
    }

    // Anchors and relative paths are left alone; only root-relative URLs
    // need the base path applied.
    if (ROOT_RELATIVE_URL_PATTERN.test(url)) {
      token.attrSet(attribute, resolveUrl(url));
    }
  };

  const defaultLinkRender =
    md.renderer.rules['link_open'] ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules['link_open'] = (tokens, idx, options, env, self) => {
    rewrite(tokens[idx], 'href', true);
    return defaultLinkRender(tokens, idx, options, env, self);
  };

  const defaultImageRender =
    md.renderer.rules['image'] ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules['image'] = (tokens, idx, options, env, self) => {
    // Images carry no `rel`, so external ones need no marking.
    rewrite(tokens[idx], 'src', false);
    return defaultImageRender(tokens, idx, options, env, self);
  };

  // Raw HTML written directly in a post never becomes a link or image token, so
  // the rules above never see it. Without this, a hand-written
  // `<img src="/diagram.svg">` would keep its bare path and 404 wherever the
  // site is served from a subdirectory.
  const rewriteRawHtml = (content: string): string =>
    content.replace(
      RAW_HTML_URL_ATTRIBUTE,
      (_match, attribute: string, quote: string, url: string) =>
        `${attribute}=${quote}${resolveUrl(url)}${quote}`,
    );

  for (const rule of ['html_block', 'html_inline'] as const) {
    const defaultRender =
      md.renderer.rules[rule] ?? ((tokens, idx) => tokens[idx]?.content ?? '');

    md.renderer.rules[rule] = (tokens, idx, options, env, self) =>
      rewriteRawHtml(defaultRender(tokens, idx, options, env, self));
  }
}

/**
 * Matches a `src` or `href` attribute whose value is a root-relative URL.
 *
 * @remarks
 * The `(?!\/)` keeps protocol-relative URLs such as `//cdn.example.com/x.png`
 * out, since those point off-site despite starting with a slash. Both quote
 * styles are captured so the original is preserved on the way back out.
 *
 * This is a regex over HTML, which is crude. It is acceptable only because the
 * input is the site author's own markdown rather than untrusted content, and
 * because it touches nothing but the inside of these two attributes. Note that
 * `srcset` is deliberately not handled: its comma-separated candidate syntax
 * needs a real parser, and nothing on this site uses it.
 */
const RAW_HTML_URL_ATTRIBUTE = /\b(src|href)=("|')(\/(?!\/)[^"']*)\2/g;
