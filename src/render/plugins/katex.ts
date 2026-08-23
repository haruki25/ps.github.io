/**
 * A markdown-it plugin that renders TeX math with KaTeX **at build time**.
 *
 * Why build-time? The reference design loads KaTeX's JavaScript in the browser
 * and typesets on every page view. Rendering here instead means the published
 * page contains finished HTML: no JavaScript ships, nothing reflows after
 * paint, and math still renders with JS disabled. The only runtime cost is the
 * KaTeX stylesheet and its fonts, which the asset pipeline copies locally.
 *
 * Syntax:
 *   - Inline: `$E = mc^2$`
 *   - Display: a `$$` fence on its own line, or `$$ ... $$` on one line.
 *
 * Currency safety: a `$` is only treated as an opening delimiter when it is
 * followed by a non-space character, and only closed by a `$` that is not
 * followed by a digit. That keeps prose like "it cost $5 and then $10" intact.
 * Escape a literal dollar sign as `\$` if you need one next to math.
 */

import katex from 'katex';
import type MarkdownIt from 'markdown-it';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs';

/** Options for {@link createKatexPlugin}. */
export interface KatexPluginOptions {
  /**
   * Called when KaTeX rejects an expression. The build continues and the raw
   * source is emitted in place, so one typo cannot break the whole site.
   */
  readonly onError: (expression: string, message: string) => void;
}

/** The backslash character, kept as a named constant so that the escape-skip
 * logic below reads clearly and needs no doubled literal. */
const BACKSLASH = String.fromCharCode(92);

/**
 * Typeset one expression, degrading gracefully on malformed input.
 */
function renderMath(
  expression: string,
  displayMode: boolean,
  options: KatexPluginOptions,
): string {
  try {
    return katex.renderToString(expression, {
      displayMode,
      // `throwOnError` surfaces problems to our own handler rather than
      // silently rendering the expression in KaTeX's red error styling.
      throwOnError: true,
      strict: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    options.onError(expression, message);
    // Fall back to the literal source, visibly marked, so the author can spot
    // it on the page instead of wondering why an equation vanished.
    const escaped = expression
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const tag = displayMode ? 'div' : 'span';
    return `<${tag} class="math-error" title="KaTeX error">${escaped}</${tag}>`;
  }
}

/**
 * Inline rule: matches `$...$` within a paragraph.
 *
 * Registered after markdown-it's `escape` rule, so an escaped dollar sign has
 * already been consumed as a literal by the time this runs.
 */
function mathInline(state: StateInline, silent: boolean): boolean {
  const src = state.src;
  const start = state.pos;

  if (src[start] !== '$') return false;
  // A `$$` run belongs to the block rule; leave it alone.
  if (src[start + 1] === '$') return false;

  const afterOpen = src[start + 1];
  if (afterOpen === undefined || /\s/.test(afterOpen)) return false;

  // Scan for the closing delimiter, stepping over backslash escapes.
  let pos = start + 1;
  let end = -1;
  while (pos < state.posMax) {
    const ch = src[pos];
    if (ch === BACKSLASH) {
      pos += 2;
      continue;
    }
    if (ch === '$') {
      end = pos;
      break;
    }
    pos++;
  }
  if (end === -1) return false;

  const beforeClose = src[end - 1];
  if (beforeClose === undefined || /\s/.test(beforeClose)) return false;

  // "$5 and $10" - a digit after the closing delimiter means this was currency.
  const afterClose = src[end + 1];
  if (afterClose !== undefined && /\d/.test(afterClose)) return false;

  const content = src.slice(start + 1, end);
  if (content.trim() === '') return false;

  if (!silent) {
    const token = state.push('math_inline', 'math', 0);
    token.markup = '$';
    token.content = content;
  }
  state.pos = end + 1;
  return true;
}

/**
 * Block rule: matches a `$$` fence, either spanning lines or closed on one.
 */
function mathBlock(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
  const openStart = state.bMarks[startLine];
  const openShift = state.tShift[startLine];
  const openMax = state.eMarks[startLine];
  if (openStart === undefined || openShift === undefined || openMax === undefined) {
    return false;
  }

  const begin = openStart + openShift;
  if (begin + 2 > openMax) return false;
  if (state.src.slice(begin, begin + 2) !== '$$') return false;

  const firstLineRest = state.src.slice(begin + 2, openMax).trim();
  const lines: string[] = [];
  let lastLine = startLine;
  let closed = false;

  if (firstLineRest.endsWith('$$') && firstLineRest.length > 2) {
    // Single-line form: `$$ x^2 $$`
    lines.push(firstLineRest.slice(0, -2));
    closed = true;
  } else {
    // Multi-line form: content runs until a line that is exactly `$$`.
    if (firstLineRest !== '') lines.push(firstLineRest);
    let line = startLine + 1;
    for (; line < endLine; line++) {
      const s = state.bMarks[line];
      const shift = state.tShift[line];
      const e = state.eMarks[line];
      if (s === undefined || shift === undefined || e === undefined) break;

      const text = state.src.slice(s + shift, e);
      if (text.trim() === '$$') {
        closed = true;
        break;
      }
      lines.push(state.src.slice(s, e));
    }
    lastLine = line;
  }

  // An unterminated fence is not math - let other rules have the text.
  if (!closed) return false;
  if (silent) return true;

  const token = state.push('math_block', 'math', 0);
  token.block = true;
  token.markup = '$$';
  token.content = lines.join('\n').trim();
  token.map = [startLine, lastLine + 1];

  state.line = lastLine + 1;
  return true;
}

/**
 * Build the plugin. Returns a function with markdown-it's plugin signature, so
 * it is applied as `md.use(createKatexPlugin({ onError }))`.
 */
export function createKatexPlugin(
  options: KatexPluginOptions,
): (md: MarkdownIt) => void {
  return (md: MarkdownIt): void => {
    md.inline.ruler.after('escape', 'math_inline', mathInline);
    md.block.ruler.after('blockquote', 'math_block', mathBlock, {
      // Allow a math fence to interrupt these constructs, matching how
      // fenced code blocks behave.
      alt: ['paragraph', 'reference', 'blockquote', 'list'],
    });

    md.renderer.rules['math_inline'] = (tokens, idx): string =>
      renderMath(tokens[idx]?.content ?? '', false, options);

    md.renderer.rules['math_block'] = (tokens, idx): string =>
      `${renderMath(tokens[idx]?.content ?? '', true, options)}\n`;
  };
}
