/**
 * The abstract base for every piece of rendered content in the site.
 *
 * @remarks
 * Deliberate design constraint: **models know nothing about configuration, the
 * filesystem, or URLs.** The `url` is computed by the content repository (which
 * owns a `SitePaths`) and handed in. That keeps models trivially constructible
 * in isolation, which is what makes them easy to reason about and easy to test.
 */

/** Constructor arguments shared by every content type. */
export interface ContentInit {
  /** Display title, from the `title:` front matter field. */
  readonly title: string;
  /** URL-safe identifier, unique within its content type. */
  readonly slug: string;
  /** Public URL this content will be published at. */
  readonly url: string;
  /** Rendered body, as trusted HTML. */
  readonly bodyHtml: string;
  /** Absolute path of the markdown file this came from, for error messages. */
  readonly sourcePath: string;
}

/**
 * Markdown that has already been parsed and rendered: the front matter split
 * off into typed fields, and the body converted to finished HTML.
 *
 * @remarks
 * Never instantiated directly - construct a concrete `Post` or `Page`.
 */
export abstract class Content {
  /** Display title, from the `title:` front matter field. */
  readonly title: string;

  /** URL-safe identifier, unique within its content type. */
  readonly slug: string;

  /** Public URL this content is published at. */
  readonly url: string;

  /** Rendered body, as trusted HTML. */
  readonly bodyHtml: string;

  /** Absolute path of the markdown file this came from. */
  readonly sourcePath: string;

  /**
   * `protected` because `Content` is abstract: you always construct a concrete
   * `Post` or `Page`.
   *
   * @param init - The fields shared by every content type.
   */
  protected constructor(init: ContentInit) {
    this.title = init.title;
    this.slug = init.slug;
    this.url = init.url;
    this.bodyHtml = init.bodyHtml;
    this.sourcePath = init.sourcePath;
  }

  /**
   * Identify this content in build logs and error messages.
   *
   * @remarks
   * Overriding `toString` means a bare `${post}` in a template literal already
   * produces something useful.
   *
   * @returns A short label such as `Post(hello-world)`.
   */
  toString(): string {
    return `${this.constructor.name}(${this.slug})`;
  }
}
