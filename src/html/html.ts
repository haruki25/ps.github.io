/**
 * A tiny, safe-by-default HTML templating primitive.
 *
 * Why not a template engine (EJS, Nunjucks, Handlebars)?
 *
 *  1. **Type safety.** Templates here are ordinary TypeScript, so a typo in a
 *     property name is a compile error. A `.ejs` file with `<%= psot.title %>`
 *     fails at build time at best, and silently renders nothing at worst.
 *  2. **Escaping by default.** Every interpolated value is HTML-escaped unless
 *     it is explicitly wrapped in {@link raw}. The dangerous case is the one
 *     you have to type out, which is the right way round.
 *  3. **No new syntax.** Loops are `.map()`, conditionals are `? :`. There is
 *     nothing to learn and nothing to configure.
 *
 * Usage:
 * ```ts
 * const title = 'Cats & Dogs';
 * render(html`<h1>${title}</h1>`);        // <h1>Cats &amp; Dogs</h1>
 * render(html`<div>${raw('<b>hi</b>')}</div>`); // <div><b>hi</b></div>
 * ```
 */

/**
 * Brand used to distinguish already-safe HTML from untrusted strings.
 * A unique symbol makes {@link RawHtml} impossible to forge accidentally -
 * a plain object literal cannot satisfy the interface.
 */
declare const RAW_BRAND: unique symbol;

/** A string that is known to be safe HTML and will be emitted verbatim. */
export interface RawHtml {
  /**
   * Phantom brand field. Never read at runtime; its only job is to make this
   * interface impossible to satisfy by accident with an object literal.
   */
  readonly [RAW_BRAND]: true;

  /** The underlying markup. */
  readonly value: string;
}

/**
 * Anything that may be interpolated into an {@link html} template.
 *
 * `null`, `undefined`, and `false` render as the empty string, which makes
 * `${condition && html`...`}` a natural way to express optional markup.
 * Arrays are flattened and concatenated, which makes `${items.map(...)}` work.
 */
export type Interpolatable =
  | string
  | number
  | boolean
  | null
  | undefined
  | RawHtml
  | readonly Interpolatable[];

/**
 * Escape the five characters that are unsafe in HTML text and attribute values.
 *
 * Both `"` and `'` are escaped so that the result is safe inside single- or
 * double-quoted attributes without the caller having to know which is in use.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Mark a string as trusted HTML that must not be escaped.
 *
 * Only ever call this on markup you generated yourself - for example the
 * output of the markdown renderer. Never call it on user input.
 */
export function raw(value: string): RawHtml {
  return { value } as RawHtml;
}

/** Type guard for {@link RawHtml}. */
function isRaw(value: unknown): value is RawHtml {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    typeof (value as { value: unknown }).value === 'string'
  );
}

/** Convert a single interpolated value into its final HTML string. */
function stringify(value: Interpolatable): string {
  // Render nothing for the "absent" values, so `${cond && ...}` works cleanly.
  if (value === null || value === undefined || value === false) return '';
  if (value === true) return '';
  if (isRaw(value)) return value.value;
  if (Array.isArray(value)) return value.map(stringify).join('');
  return escapeHtml(String(value));
}

/**
 * Tagged template literal that builds escaped HTML.
 *
 * Returns {@link RawHtml} rather than a plain string so that nesting templates
 * (`html`<ul>${html`<li>a</li>`}</ul>``) does not double-escape the inner one.
 */
export function html(
  strings: TemplateStringsArray,
  ...values: Interpolatable[]
): RawHtml {
  // Interleave the literal chunks with the stringified interpolations. There is
  // always exactly one more literal chunk than there are values.
  let out = strings[0] ?? '';
  for (let i = 0; i < values.length; i++) {
    out += stringify(values[i]) + (strings[i + 1] ?? '');
  }
  return raw(out);
}

/** Unwrap a finished template into the string that gets written to disk. */
export function render(node: RawHtml): string {
  return node.value;
}
