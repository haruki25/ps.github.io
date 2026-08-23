# Project conventions

## Documentation: TypeDoc style, always

**Every exported symbol carries a TypeDoc comment.** This is enforced, not
aspirational: `npm run docs:check` fails the moment something is undocumented or
a `{@link}` points at nothing. Run it before committing.

```bash
npm run docs:check   # validate comments, write nothing
npm run docs         # generate docs/api/
```

### The rules

1. **Use `/** ... *&#47;`, never `//`, for anything exported.** Line comments are
   for explaining a step *inside* a function body. TypeDoc ignores them.

2. **A file-header comment documents the *module*, not the class inside it.**
   TypeDoc treats them separately, so a class needs its own comment directly
   above `export class Foo`, even when the file header already describes it.

3. **Document every property**, including constructor parameter properties
   (`private readonly foo: Bar`). Put the comment above the parameter, inside
   the constructor signature.

4. **Use the tags, not prose, for structured facts:**

   | Tag | When |
   | --- | --- |
   | `@param name - description` | Every parameter. Note the ` - ` separator. |
   | `@returns` | Any function returning something non-obvious. |
   | `@throws` | Every exception a caller could reasonably catch. |
   | `@remarks` | The *why*: rationale, trade-offs, context. |
   | `@example` | Anything whose usage isn't obvious from the signature. |
   | `{@link Foo}` | Cross-references. Only to symbols in scope. |

5. **`{@link}` only resolves to imported symbols.** Referring to something this
   file doesn't import is a validation warning - use backticks instead.

6. **Lead with what it does; use `@remarks` for why.** The first line becomes
   the summary in generated docs and in editor tooltips, so it should stand
   alone as a sentence.

### Shape

```ts
/**
 * Convert arbitrary text into a URL-safe slug.
 *
 * @remarks
 * Accents are decomposed and stripped rather than dropped, so titles in most
 * Latin-script languages produce a readable slug instead of an empty one.
 *
 * @param text - The text to convert, typically a title.
 * @returns A lowercase, hyphen-separated slug.
 * @throws {FrontMatterError} If no usable slug can be derived.
 *
 * @example
 * ```ts
 * slugify('Hello, World!');  // 'hello-world'
 * ```
 */
```

## Architecture

Two rules keep the codebase navigable. Both are load-bearing:

- **`Layout` owns the page shell.** The `<head>`, nav, theme toggle, and footer
  are written once in the abstract base. A subclass supplies only its metadata
  and the markup inside `<main>`.
- **`SitePaths` owns every path and URL.** No other module builds a URL by
  string concatenation. If you need a new URL, add a method there.

Single-responsibility boundaries worth preserving:

- `ContentRepository` is the only module that calls `fs`.
- `MarkdownRenderer` is the only module that knows markdown exists.
- `html.ts` escapes by default; `raw()` is the deliberate opt-out.

## JavaScript on the published site

The site ships **only** the theme toggle (~20 lines, inlined). Everything else
is HTML and CSS. Syntax highlighting and math both render at build time.

Do not add a client-side dependency without a concrete reason - "it would be
nice" is not one. If something can be done at build time, do it at build time.

## Before committing

```bash
npm run typecheck
npm run docs:check
npm run build
```
