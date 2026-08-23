/**
 * The colour-scheme toggle: its markup, and the only JavaScript on the site.
 *
 * @remarks
 * Everything else here renders to pure HTML and CSS. A theme toggle cannot -
 * remembering a reader's choice across pages requires reading storage and
 * acting on it, and there is no CSS-only way to do that. The cost is kept to
 * roughly twenty lines, inlined rather than fetched, and the site remains fully
 * functional with JavaScript disabled: it simply follows the operating system's
 * setting, which is what {@link renderThemeInitScript} would otherwise override.
 *
 * How the three pieces fit together:
 *
 * 1. {@link renderThemeInitScript} runs **before first paint**, in `<head>`,
 *    and applies a stored preference. Without it the page would paint in the
 *    system theme and then visibly flip - the "flash of wrong theme".
 * 2. {@link renderThemeToggle} is the button itself.
 * 3. {@link renderThemeToggleScript} wires up the click handler at end of body.
 *
 * The contract between them is one attribute: `data-theme` on `<html>`, which
 * is `'light'`, `'dark'`, or absent. Absent means "follow the system", which
 * the stylesheet handles with a `prefers-color-scheme` media query.
 */

import { html, raw, type RawHtml } from './html.js';

/** The `localStorage` key holding the reader's explicit choice, if any. */
const STORAGE_KEY = 'theme';

/**
 * The blocking script that applies a stored theme before the page paints.
 *
 * @remarks
 * This must be inline and synchronous, in `<head>`, above the stylesheet. An
 * external or deferred script would run after first paint and the flash it
 * exists to prevent would happen anyway.
 *
 * Every storage access is wrapped in `try`/`catch`: reading `localStorage`
 * throws outright in some privacy modes, and a theme preference is never worth
 * breaking a page over.
 *
 * @returns A `<script>` element for the document head.
 */
export function renderThemeInitScript(): RawHtml {
  const script = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;
  return html`<script>${raw(script)}</script>`;
}

/**
 * The toggle button.
 *
 * @remarks
 * Both icons are always present in the markup; the stylesheet reveals whichever
 * matches the active theme. Swapping them in CSS rather than JavaScript keeps
 * the click handler trivial and means the correct icon is already showing on
 * first paint.
 *
 * The button carries a starting `aria-label` for the no-JavaScript case; the
 * handler keeps it accurate afterwards.
 *
 * @returns A `<button>` element for the site header.
 */
export function renderThemeToggle(): RawHtml {
  // Sun: a filled disc with eight rays. Shown in dark mode, where clicking
  // returns you to light.
  const sun = raw(
    '<circle cx="12" cy="12" r="4.2"/>' +
      '<path d="M12 1.6v2.6M12 19.8v2.6M22.4 12h-2.6M4.2 12H1.6' +
      'M19.35 4.65l-1.84 1.84M6.49 17.51l-1.84 1.84' +
      'M19.35 19.35l-1.84-1.84M6.49 6.49L4.65 4.65" ' +
      'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" fill="none"/>',
  );

  // Moon: a crescent, drawn as one filled path. Shown in light mode, where
  // clicking switches to dark.
  const moon = raw(
    '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  );

  return html`<button
        id="theme-toggle"
        class="theme-toggle"
        type="button"
        aria-label="Switch colour theme"
        title="Switch colour theme"
      ><svg class="icon icon-sun" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false">${sun}</svg><svg class="icon icon-moon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false">${moon}</svg></button>`;
}

/**
 * The click handler, placed at the end of `<body>`.
 *
 * @remarks
 * "Effective theme" is the explicit `data-theme` if one is set, and the system
 * preference otherwise. Resolving it on every click means the first click from
 * a fresh visit always flips away from what the reader is actually looking at,
 * rather than assuming light.
 *
 * @returns A `<script>` element for the end of the document body.
 */
export function renderThemeToggleScript(): RawHtml {
  const script = [
    '(function(){',
    "var b=document.getElementById('theme-toggle');if(!b)return;",
    'var r=document.documentElement;',
    'function eff(){',
    "var t=r.getAttribute('data-theme');",
    "return t||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');",
    '}',
    'function sync(){',
    "var l=eff()==='dark'?'Switch to light theme':'Switch to dark theme';",
    "b.setAttribute('aria-label',l);b.setAttribute('title',l);",
    '}',
    'sync();',
    "b.addEventListener('click',function(){",
    "var n=eff()==='dark'?'light':'dark';",
    "r.setAttribute('data-theme',n);",
    `try{localStorage.setItem('${STORAGE_KEY}',n);}catch(e){}`,
    'sync();',
    '});',
    '})();',
  ].join('');

  return html`<script>${raw(script)}</script>`;
}
