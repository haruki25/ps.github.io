/**
 * The single point of contact between the site and the filesystem.
 *
 * Nothing else in `src/` calls `fs`. That isolation is deliberate: the layouts
 * and the builder operate purely on {@link Post} and {@link Page} objects, so
 * they can be exercised with hand-built models and never need a directory of
 * fixture files.
 *
 * Loading happens in two phases, for a specific reason. Shiki must know which
 * code languages a document uses *before* rendering it, because markdown-it's
 * highlight hook is synchronous. So every file is read and parsed first, the
 * renderer is given the whole corpus to prepare against, and only then is any
 * markdown converted to HTML.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import type { SitePaths } from '../config/SitePaths.js';
import type { MarkdownRenderer } from '../render/MarkdownRenderer.js';
import { Page } from '../models/Page.js';
import { Post } from '../models/Post.js';
import {
  FrontMatterError,
  FrontMatterReader,
  parseDocument,
  type RawDocument,
} from './FrontMatter.js';
import { slugify, stripDatePrefix } from '../util/slug.js';

/** Everything the site is built from. */
export interface ContentSet {
  /** All published posts, newest first. */
  readonly posts: readonly Post[];
  /** All standalone pages, in no particular order. */
  readonly pages: readonly Page[];
}

/** Options for {@link ContentRepository}. */
export interface ContentRepositoryOptions {
  /**
   * Include posts marked `draft: true`.
   *
   * The dev server sets this so you can preview work in progress; the
   * production build leaves it off so drafts never ship.
   */
  readonly includeDrafts: boolean;
  /** Receives non-fatal problems, such as a skipped draft. */
  readonly onWarning: (message: string) => void;
}

/**
 * Loads markdown from disk and returns fully rendered models.
 *
 * @remarks
 * The only module in `src/` that calls `fs`. Layouts and the builder operate
 * purely on {@link Post} and {@link Page} objects, so they can be exercised
 * with hand-built models and never need a directory of fixture files.
 */
export class ContentRepository {
  /**
   * @param paths - Where content lives and what URLs it maps to.
   * @param renderer - Converts markdown bodies to HTML.
   * @param options - Draft handling and a warning sink.
   */
  constructor(
    private readonly paths: SitePaths,
    private readonly renderer: MarkdownRenderer,
    private readonly options: ContentRepositoryOptions,
  ) {}

  /**
   * Read, parse, and render everything under `content/`.
   *
   * @throws {FrontMatterError} if any document has invalid front matter.
   * @throws {Error} if two posts or two pages claim the same slug.
   */
  async load(): Promise<ContentSet> {
    const [postDocs, pageDocs] = await Promise.all([
      this.readMarkdownDir(this.paths.postsDir),
      this.readMarkdownDir(this.paths.pagesDir),
    ]);

    // Phase one is done: give the renderer every source at once so it can load
    // the code grammars they need before we render any of them.
    await this.renderer.prepare(
      [...postDocs, ...pageDocs].map((doc) => doc.body),
    );

    const posts = postDocs
      .map((doc) => this.buildPost(doc))
      .filter((post): post is Post => post !== null)
      .sort(Post.byNewestFirst);

    const pages = pageDocs.map((doc) => this.buildPage(doc));

    this.assertUniqueSlugs('post', posts);
    this.assertUniqueSlugs('page', pages);

    return { posts, pages };
  }

  /**
   * Read every `.md` file directly inside one directory.
   *
   * A missing directory is not an error - a site with no posts yet is a
   * perfectly valid site - but any other filesystem failure propagates.
   */
  private async readMarkdownDir(directory: string): Promise<RawDocument[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(directory);
    } catch (error) {
      if (isNotFoundError(error)) return [];
      throw error;
    }

    const markdownFiles = entries
      .filter((name) => name.toLowerCase().endsWith('.md'))
      // Sort for deterministic build output regardless of filesystem ordering.
      .sort();

    return Promise.all(
      markdownFiles.map(async (name) => {
        const sourcePath = path.join(directory, name);
        const contents = await fs.readFile(sourcePath, 'utf8');
        return parseDocument(sourcePath, contents);
      }),
    );
  }

  /**
   * Turn one parsed document into a {@link Post}.
   * Returns `null` for a draft that is being skipped.
   */
  private buildPost(doc: RawDocument): Post | null {
    const reader = new FrontMatterReader(doc);

    if (reader.boolean('draft', false) && !this.options.includeDrafts) {
      this.options.onWarning(
        `Skipping draft: ${path.basename(doc.sourcePath)}`,
      );
      return null;
    }

    const title = reader.requireString('title');
    const slug = this.resolveSlug(reader, doc, title);

    return new Post({
      title,
      slug,
      url: this.paths.postUrl(slug),
      bodyHtml: this.renderer.render(doc.body),
      sourcePath: doc.sourcePath,
      date: reader.requireDate('date'),
      tags: reader.stringArray('tags'),
      description: reader.optionalString('description'),
    });
  }

  /** Turn one parsed document into a {@link Page}. */
  private buildPage(doc: RawDocument): Page {
    const reader = new FrontMatterReader(doc);
    const title = reader.requireString('title');
    const slug = this.resolveSlug(reader, doc, title);

    return new Page({
      title,
      slug,
      url: this.paths.pageUrl(slug),
      bodyHtml: this.renderer.render(doc.body),
      sourcePath: doc.sourcePath,
    });
  }

  /**
   * Decide a document's slug, in order of preference:
   *   1. an explicit `slug:` in front matter - the escape hatch that lets you
   *      rename a file without breaking an already-published URL;
   *   2. the filename, minus any `YYYY-MM-DD-` prefix;
   *   3. a slugified form of the title, if the filename yields nothing usable.
   */
  private resolveSlug(
    reader: FrontMatterReader,
    doc: RawDocument,
    title: string,
  ): string {
    const explicit = reader.optionalString('slug');
    if (explicit !== null) return slugify(explicit);

    const stem = path.basename(doc.sourcePath, path.extname(doc.sourcePath));
    const fromFilename = slugify(stripDatePrefix(stem));
    if (fromFilename !== '') return fromFilename;

    const fromTitle = slugify(title);
    if (fromTitle !== '') return fromTitle;

    throw new FrontMatterError(
      doc.sourcePath,
      'could not derive a slug from the filename or title; add an explicit "slug:" field',
    );
  }

  /**
   * Reject duplicate slugs.
   *
   * Without this check, two posts sharing a slug would silently overwrite each
   * other in the output directory and one would simply vanish.
   */
  private assertUniqueSlugs(
    kind: string,
    items: readonly { slug: string; sourcePath: string }[],
  ): void {
    const seen = new Map<string, string>();
    for (const item of items) {
      const existing = seen.get(item.slug);
      if (existing !== undefined) {
        throw new Error(
          `Duplicate ${kind} slug "${item.slug}":\n  ${existing}\n  ${item.sourcePath}\n` +
            'Rename one of the files or give one an explicit "slug:" in its front matter.',
        );
      }
      seen.set(item.slug, item.sourcePath);
    }
  }
}

/** Narrow an unknown caught value to Node's "no such file or directory". */
function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'ENOENT'
  );
}
