/**
 * ============================================================================
 *  SITE CONFIGURATION - this is the file you edit to make the site yours.
 * ============================================================================
 *
 * Everything the generator needs to know about *you* lives here: your name,
 * your links, your navigation, and where files live on disk. No template or
 * layout hard-codes any of it, so changing your email address or adding a nav
 * item never means touching `src/`.
 *
 */

import type { SiteConfig } from './src/config/types.js';

const config: SiteConfig = {
  // --- Identity -------------------------------------------------------------
  title: 'Piyush Soni',
  author: 'Piyush Soni',
  description: 'Its PS',

  // The origin only: no path, no trailing slash. Used for Open Graph tags,
  // canonical links, and the RSS feed. Which path within this host the site
  // occupies is `basePath`, below.
  url: 'https://haruki25.github.io',

  // Subdirectory the site is served from.
  //
  // The repository is named ps.github.io but belongs to the user haruki25, so
  // it is NOT a user site - only haruki25.github.io would be. GitHub therefore
  // serves it as a project site at:
  //
  //     https://haruki25.github.io/ps.github.io/
  //
  // Rename the repository to haruki25.github.io and set this back to '' to be
  // served from the domain root instead.
  basePath: '/ps.github.io',
  lang: 'en',
  copyrightStartYear: 2026,

  // --- Navigation -----------------------------------------------------------
  // Rendered left to right in the header. Tag pages are generated but kept out
  // of the nav until there are enough posts to justify them - to surface them,
  // just add `{ label: 'Tags', href: '/tags.html' }` here.
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Bio', href: '/bio.html' },
    { label: 'Blog', href: '/archives.html' },
  ],

  // --- Contact / profile links ---------------------------------------------
  // Shown as an icon + label row on the home page, in this order.
  social: [
    {
      kind: 'linkedin',
      label: 'haruki25',
      url: 'https://www.linkedin.com/in/haruki25',
    },
    {
      kind: 'scholar',
      label: 'Piyush Soni',
      url: 'https://scholar.google.com/citations?user=dd5GYCIAAAAJ',
    },
    {
      kind: 'github',
      label: 'haruki25',
      url: 'https://github.com/haruki25',
    },
    {
      kind: 'email',
      label: 'pssoni2504@gmail.com',
      url: 'mailto:pssoni2504@gmail.com',
    },
  ],

  // --- URL layout -----------------------------------------------------------
  postsBasePath: '/blog',
  tagsBasePath: '/tags',

  // --- Filesystem layout ----------------------------------------------------
  // Relative to the repository root; resolved to absolute paths at startup.
  contentDir: 'content',
  assetsDir: 'assets',
  outputDir: 'dist',

  // --- Presentation ---------------------------------------------------------
  // Roboto matches the reference design. Set to `null` to drop the external
  // request entirely and use the system sans-serif stack instead.
  googleFontsHref:
    'https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&family=Source+Code+Pro:wght@400&display=swap',

  // Syntax highlighting themes, one per colour scheme. Both are baked into
  // every code block as CSS variables, so switching theme in the browser needs
  // no re-highlighting. Any theme bundled with Shiki works here.
  codeThemes: {
    light: 'github-light',
    dark: 'github-dark',
  },
};

export default config;
