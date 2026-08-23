/**
 * Plain-text helpers for deriving metadata from rendered HTML.
 */

/** Decode the handful of entities our own escaping introduces. */
function decodeBasicEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Produce a short plain-text summary from a block of rendered HTML.
 *
 * Used for `<meta name="description">` when a post sets no explicit
 * `description:` in its front matter. Truncation happens at a word boundary so
 * the summary never ends mid-word.
 *
 * This is intentionally crude - it strips tags with a regex rather than parsing
 * the HTML. That is acceptable precisely because the input is our own rendered
 * markdown rather than arbitrary third-party markup, and because the result is
 * only ever used as plain text inside an attribute value.
 */
export function excerptFromHtml(bodyHtml: string, maxLength = 160): string {
  // Drop anything inside a math element first: TeX markup reads as noise in a
  // search result snippet.
  const withoutMath = bodyHtml.replace(
    /<span class="katex[\s\S]*?<\/span>/g,
    '',
  );

  const text = decodeBasicEntities(withoutMath.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= maxLength) return text;

  const clipped = text.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(' ');
  const trimmed = lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped;
  return `${trimmed.replace(/[),.;:]+$/, '')}...`;
}
