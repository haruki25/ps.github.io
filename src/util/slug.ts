/**
 * URL slug generation.
 *
 * A slug is the filename-and-URL-safe form of a title: `"Hello, World!"`
 * becomes `"hello-world"`. Slugs are permanent - once a post is published its
 * slug is its URL forever - so a post may override the generated value by
 * setting `slug:` explicitly in its front matter.
 */

/**
 * Convert arbitrary text into a lowercase, hyphen-separated slug.
 *
 * Accented characters are decomposed and stripped of their diacritics
 * (`"Café"` -> `"cafe"`) rather than dropped, so titles in most Latin-script
 * languages produce a readable slug instead of an empty one.
 */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')                 // split "é" into "e" + combining accent
    .replace(/[\u0300-\u036f]/g, '')   // drop the combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')       // any run of non-alphanumerics -> one hyphen
    .replace(/^-+|-+$/g, '');          // trim leading/trailing hyphens
}

/**
 * Strip a leading `YYYY-MM-DD-` date prefix from a filename stem.
 *
 * Post files are named `2026-08-23-hello-world.md` so that they sort
 * chronologically in a directory listing, but the date does not belong in the
 * URL - that file becomes `/blog/hello-world.html`.
 */
export function stripDatePrefix(stem: string): string {
  return stem.replace(/^\d{4}-\d{2}-\d{2}-/, '');
}
