/**
 * The build orchestrator: turns `content/` into `dist/`.
 *
 * This class is deliberately the only place where the whole pipeline is
 * visible at once. Each collaborator it drives does one job and knows nothing
 * about the others:
 *
 *   ContentRepository  markdown files -> Post and Page models
 *   TagIndex           posts          -> tags
 *   Layout subclasses  models         -> HTML documents
 *   FeedGenerator      posts          -> RSS
 *   AssetPipeline      disk I/O
 *
 * Reading `build()` top to bottom should tell you everything about how the site
 * is produced, without needing to open any of them.
 */

import type { SiteConfig } from './config/types.js';
import { SitePaths } from './config/SitePaths.js';
import { ContentRepository, type ContentSet } from './content/ContentRepository.js';
import { TagIndex } from './content/TagIndex.js';
import { MarkdownRenderer } from './render/MarkdownRenderer.js';
import { FeedGenerator } from './render/FeedGenerator.js';
import { AssetPipeline } from './assets/AssetPipeline.js';
import { Logger } from './util/Logger.js';

import type { Layout, LayoutContext } from './layouts/Layout.js';
import { HomeLayout } from './layouts/HomeLayout.js';
import { PageLayout } from './layouts/PageLayout.js';
import { PostLayout } from './layouts/PostLayout.js';
import { ArchiveLayout } from './layouts/ArchiveLayout.js';
import { TagLayout } from './layouts/TagLayout.js';
import { TagIndexLayout } from './layouts/TagIndexLayout.js';

/** The slug of the page rendered at the site root. */
const HOME_PAGE_SLUG = 'home';

/** Options for {@link SiteBuilder}. */
export interface SiteBuilderOptions {
  /** Repository root; all configured paths resolve against this. */
  readonly rootDir: string;
  /** Include posts marked `draft: true`. The dev server sets this. */
  readonly includeDrafts: boolean;
  /** Where progress and warnings go. */
  readonly logger: Logger;
}

/** What a completed build produced. */
export interface BuildResult {
  /** Published posts, excluding drafts unless drafts were requested. */
  readonly postCount: number;
  /** Standalone pages, including the home page. */
  readonly pageCount: number;
  /** Distinct tags derived from the posts. */
  readonly tagCount: number;
  /** Generated files written, excluding copied static assets. */
  readonly filesWritten: number;
  /** Wall-clock duration of the build, in milliseconds. */
  readonly durationMs: number;
  /** Every non-fatal problem reported during the build. */
  readonly warnings: readonly string[];
}

/**
 * Drives a complete build, from markdown on disk to a finished site.
 *
 * @remarks
 * Construct with {@link SiteBuilder.create}, not `new`: the markdown renderer
 * it depends on is built asynchronously. Reading {@link SiteBuilder.build} top
 * to bottom should explain the whole pipeline without opening anything else.
 */
export class SiteBuilder {
  /** Resolved input directories, output paths, and public URLs. */
  private readonly paths: SitePaths;

  /** Filesystem operations: cleaning, copying, and writing. */
  private readonly assets: AssetPipeline;

  /** RSS feed rendering. */
  private readonly feed: FeedGenerator;

  /** Counts every file written, for the closing summary. */
  private filesWritten = 0;

  /**
   * @param config - The site configuration.
   * @param options - Root directory, draft handling, and a logger.
   * @param renderer - A markdown renderer with its grammars already loaded.
   * @param paths - Resolved paths and URLs, shared with the renderer.
   */
  private constructor(
    private readonly config: SiteConfig,
    private readonly options: SiteBuilderOptions,
    private readonly renderer: MarkdownRenderer,
    paths: SitePaths,
  ) {
    this.paths = paths;
    this.assets = new AssetPipeline(paths);
    this.feed = new FeedGenerator(config, paths);
  }

  /**
   * Construct a builder.
   *
   * @remarks
   * Asynchronous because the markdown renderer has to load its syntax
   * highlighting grammars before it can be used.
   *
   * The {@link SitePaths} is built here rather than in the constructor because
   * the renderer needs it: markdown bodies contain hand-written root-relative
   * links, and those need the same base path treatment as generated URLs.
   *
   * @param config - The site configuration.
   * @param options - Root directory, draft handling, and a logger.
   * @returns A builder ready to {@link SiteBuilder.build}.
   */
  static async create(
    config: SiteConfig,
    options: SiteBuilderOptions,
  ): Promise<SiteBuilder> {
    const paths = new SitePaths(config, options.rootDir);

    const renderer = await MarkdownRenderer.create({
      codeThemes: config.codeThemes,
      resolveUrl: (url) => paths.assetUrl(url),
      onWarning: (message) => options.logger.warn(message),
    });

    return new SiteBuilder(config, options, renderer, paths);
  }

  /**
   * Release resources held by this builder.
   *
   * @remarks
   * Call this when a builder will not be used again. A one-shot build can skip
   * it, since the process exits immediately afterwards, but any long-lived
   * process that builds repeatedly must call it or it will leak a syntax
   * highlighter per build.
   */
  dispose(): void {
    this.renderer.dispose();
  }

  /** Run a complete build. */
  async build(): Promise<BuildResult> {
    const startedAt = Date.now();
    const buildTime = new Date();
    const { logger } = this.options;

    // 1. Start from an empty output directory so deletions propagate.
    await this.assets.clean();

    // 2. Load and render all markdown.
    const repository = new ContentRepository(this.paths, this.renderer, {
      includeDrafts: this.options.includeDrafts,
      onWarning: (message) => logger.warn(message),
    });
    const content = await repository.load();

    // 3. Derive tags from the posts.
    const tags = new TagIndex(content.posts, this.paths);

    // 4. Render every page.
    const ctx: LayoutContext = { config: this.config, paths: this.paths, buildTime };
    await this.renderHome(ctx, content);
    await this.renderPages(ctx, content);
    await this.renderPosts(ctx, content, tags);
    await this.renderArchive(ctx, content);
    await this.renderTagPages(ctx, tags);

    // 5. Feed and static files.
    await this.writeOutput(
      this.paths.feedUrl,
      this.feed.render(content.posts, buildTime),
    );
    await this.assets.copyStaticAssets();

    const fontCount = await this.assets.copyKatexAssets();
    logger.detail(`vendored KaTeX stylesheet and ${fontCount} font files`);

    return {
      postCount: content.posts.length,
      pageCount: content.pages.length,
      tagCount: tags.all.length,
      filesWritten: this.filesWritten,
      durationMs: Date.now() - startedAt,
      warnings: logger.collectedWarnings,
    };
  }

  // --- Individual page groups ----------------------------------------------

  /**
   * The site root, from `content/pages/home.md`.
   *
   * A missing home page is fatal, and the error says exactly which file to
   * create rather than leaving an empty directory to puzzle over.
   */
  private async renderHome(
    ctx: LayoutContext,
    content: ContentSet,
  ): Promise<void> {
    const home = content.pages.find((page) => page.slug === HOME_PAGE_SLUG);
    if (!home) {
      throw new Error(
        `Missing home page: expected ${this.paths.pagesDir}/${HOME_PAGE_SLUG}.md`,
      );
    }
    await this.renderLayout(this.paths.homeUrl, new HomeLayout(ctx, home));
  }

  /** Every page except the home page, at `/<slug>.html`. */
  private async renderPages(
    ctx: LayoutContext,
    content: ContentSet,
  ): Promise<void> {
    for (const page of content.pages) {
      if (page.slug === HOME_PAGE_SLUG) continue;
      await this.renderLayout(page.url, new PageLayout(ctx, page));
    }
  }

  /** Every post, at `/blog/<slug>.html`. */
  private async renderPosts(
    ctx: LayoutContext,
    content: ContentSet,
    tags: TagIndex,
  ): Promise<void> {
    for (const post of content.posts) {
      // Resolve the post's tag names into Tag objects so each can link to its
      // listing page. A name always resolves, because the index was built from
      // these very posts.
      const postTags = post.tags
        .map((name) => tags.find(name))
        .filter((tag): tag is NonNullable<typeof tag> => tag !== undefined);

      await this.renderLayout(post.url, new PostLayout(ctx, post, postTags));
    }
  }

  /** The year-grouped blog index. */
  private async renderArchive(
    ctx: LayoutContext,
    content: ContentSet,
  ): Promise<void> {
    await this.renderLayout(
      this.paths.blogUrl,
      new ArchiveLayout(ctx, content.posts),
    );
  }

  /**
   * The tag index and one page per tag.
   *
   * Skipped entirely when nothing is tagged, so an untagged site does not
   * publish an empty "Tags" page.
   */
  private async renderTagPages(
    ctx: LayoutContext,
    tags: TagIndex,
  ): Promise<void> {
    if (tags.isEmpty) return;

    await this.renderLayout(
      this.paths.tagIndexUrl,
      new TagIndexLayout(ctx, tags.all),
    );

    for (const tag of tags.all) {
      await this.renderLayout(tag.url, new TagLayout(ctx, tag));
    }
  }

  // --- Output helpers -------------------------------------------------------

  /** Render one layout and write it to the file its URL maps to. */
  private async renderLayout(url: string, layout: Layout): Promise<void> {
    await this.writeOutput(url, layout.render());
  }

  /** Write one generated file, counting it toward the summary. */
  private async writeOutput(url: string, contents: string): Promise<void> {
    await this.assets.writeFile(this.paths.outputFileFor(url), contents);
    this.filesWritten += 1;
  }
}
