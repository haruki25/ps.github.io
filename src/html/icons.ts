/**
 * Inline SVG icons for the home page contact row.
 *
 * These are embedded directly in the generated HTML rather than loaded from an
 * icon font (as the reference design does) for three reasons: no extra network
 * request, no flash of unstyled glyphs, and `currentColor` means the icons
 * inherit link colour and hover state for free.
 *
 * Provenance:
 *  - `github`, `scholar`, `x` are the official brand marks from Simple Icons
 *    (https://simpleicons.org), released under CC0 1.0 Universal. They are
 *    vendored here verbatim so the project has no runtime icon dependency.
 *  - `linkedin` and `email` are hand-authored for this project. Simple Icons
 *    no longer distributes a LinkedIn mark, and a generic envelope needs no
 *    brand reference at all.
 *
 * All icons share a 24x24 viewBox and are drawn as solid fills, so they sit
 * together as one visually consistent set.
 *
 * NOTE: this file is checked in as ordinary source. Edit it by hand if you want
 * to add an icon; there is no generation step to re-run.
 */

import { html, raw, type RawHtml } from './html.js';
import type { SocialKind } from '../config/types.js';

/** A single icon: the inner markup of a 24x24 `<svg>`. */
export interface Icon {
  /** Accessible name, used for the `aria-label` on the surrounding link. */
  readonly title: string;
  /** Raw SVG child elements, drawn in `currentColor`. */
  readonly body: string;
}

/**
 * The complete icon set, keyed by {@link SocialKind}.
 *
 * Typing this as `Record<SocialKind, Icon>` means adding a new `SocialKind`
 * without adding its icon is a compile error.
 */
export const ICONS: Readonly<Record<SocialKind, Icon>> = {
  linkedin: {
    title: "LinkedIn",
    body:
      "<circle cx=\"3.4\" cy=\"3.6\" r=\"2.4\"/><path d=\"M1 8.4h4.8V23H1z\"/><path d=\"M8.6 8.4h4.6v2h.06c.64-1.2 2.2-2.47 4.54-2.47 4.85 0 5.75 3.1 5.75 7.13V23h-4.8v-6.9c0-1.65-.03-3.77-2.33-3.77-2.34 0-2.7 1.8-2.7 3.65V23H8.6z\"/>",
  },
  scholar: {
    title: "Google Scholar",
    body:
      "<path d=\"M5.242 13.769L0 9.5 12 0l12 9.5-5.242 4.269C17.548 11.249 14.978 9.5 12 9.5c-2.977 0-5.548 1.748-6.758 4.269zM12 10a7 7 0 1 0 0 14 7 7 0 0 0 0-14z\"/>",
  },
  github: {
    title: "GitHub",
    body:
      "<path d=\"M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12\"/>",
  },
  email: {
    title: "Email",
    body:
      "<path d=\"M2 4h20a2 2 0 0 1 2 2v.4l-12 7.2L0 6.4V6a2 2 0 0 1 2-2z\"/><path d=\"M0 8.75V18a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V8.75l-12 7.2-12-7.2z\"/>",
  },
  x: {
    title: "X",
    body:
      "<path d=\"M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z\"/>",
  },
};

/**
 * Render one icon as an inline `<svg>`.
 *
 * The icon is marked `aria-hidden` because the link it sits inside always
 * carries a visible text label; announcing the icon too would be redundant.
 */
export function renderIcon(kind: SocialKind): RawHtml {
  const icon = ICONS[kind];
  return html`<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" focusable="false">${raw(icon.body)}</svg>`;
}
