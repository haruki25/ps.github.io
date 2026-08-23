# ps.github.io

A small static site generator and the site it builds. No framework, four
dependencies, and the only JavaScript on the published site is the theme toggle.

## Publishing a post

```bash
npm run new -- "The Title Of My Post"   # creates content/posts/YYYY-MM-DD-slug.md
npm run dev                             # preview at http://localhost:4000
git push                                # Actions builds and deploys
```

That's the whole workflow. The date prefix on the filename keeps the directory
in chronological order and never appears in the URL, so
`2026-08-23-hello-world.md` publishes at `/blog/hello-world.html`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run build` | Build the site into `dist/` |
| `npm run build -- --drafts` | Build including posts marked `draft: true` |
| `npm run dev` | Build, serve on :4000, rebuild when `content/` changes |
| `npm run new -- "Title"` | Create a new post file |
| `npm run typecheck` | Run the type checker |
| `npm run docs:check` | Validate every TypeDoc comment, write nothing |
| `npm run docs` | Generate API docs into `docs/api/` |
| `npm run clean` | Delete `dist/` |

If port 4000 is taken, `npm run dev` steps to the next free one. Pin it with
`PORT=8080 npm run dev`, which fails loudly rather than substituting.

## Writing

Every post is a markdown file with a small YAML header:

```yaml
---
title: "Hello World"
date: 2026-08-23T10:00:00.000Z
tags: [Meta, TypeScript]
description: "Shown in search results and the RSS feed."
draft: true
---
```

Only `title` and `date` are required.

- **Drafts** - `draft: true` keeps a post out of the published site while still
  showing it in `npm run dev`.
- **Tags** - need no setup. Writing a new tag creates its page; removing the
  last use of a tag removes it.
- **Slugs** - derived from the filename. Set `slug:` explicitly to rename a file
  without breaking a URL that's already published.
- **Math** - `$inline$` and `$$display$$`, rendered by KaTeX at build time.
- **Code** - fenced blocks, highlighted at build time. Languages are detected
  automatically; nothing to configure.

Pages (as opposed to posts) live in `content/pages/`. `home.md` becomes the site
root; every other file becomes `/<name>.html`.

## Configuration

`site.config.ts` holds everything that makes the site yours - name, links, nav,
fonts, code themes, and the paths on disk. It's typed, so a mistake there is a
compile error rather than a missing element on the page.

Start by replacing the placeholder URLs in the `social` array.

### `basePath` - read this before your first deploy

GitHub Pages serves a repository named exactly `<username>.github.io` at the
domain root. **Any other repository name** is served from a subdirectory, at
`https://<username>.github.io/<repo>/`.

- Repo is `<your-username>.github.io` → leave `basePath: ''`.
- Repo has any other name → set `basePath: '/<repo>'`.

Get this wrong and every stylesheet, link, and icon on the site 404s, while the
build itself reports complete success. It is the one setting that cannot be
caught by the type checker.

## Dark mode

The site follows the reader's operating system by default, and a toggle in the
header lets them override it. The choice persists across pages and visits.

The mechanism is one attribute on `<html>`:

| `data-theme` | Meaning |
| --- | --- |
| *absent* | Follow the OS (the default) |
| `light` | Force light |
| `dark` | Force dark |

Both palettes are CSS custom properties in `assets/css/style.css`. Because
"follow the OS" is the *absence* of the attribute, the dark palette is declared
twice - once under `prefers-color-scheme`, once under `[data-theme='dark']`.
Keep the two blocks in sync; they sit next to each other for that reason.

Code blocks carry both themes at once as `--shiki-light` / `--shiki-dark`
variables, so switching costs nothing at runtime and needs no re-highlighting.

This is the **only** JavaScript on the site: about twenty lines, inlined rather
than fetched. A small blocking script in `<head>` applies the stored preference
before first paint, which is what prevents a visible flash of the wrong theme.
With JavaScript disabled the site still renders correctly and follows the OS -
only the toggle stops working.

## How it's built

`content/` (markdown) → `dist/` (static HTML), in one pass:

```
src/
  index.ts              entry point: flags, root dir, exit code
  SiteBuilder.ts        orchestrates the build - read this first
  config/
    types.ts            the shape of site.config.ts
    SitePaths.ts        every path and URL decision, in one class
  content/
    ContentRepository.ts  the only module that touches the filesystem
    FrontMatter.ts        parsing and validation, with precise errors
    TagIndex.ts           derives tags from posts
  models/
    Content.ts          abstract base
    Post.ts  Page.ts  Tag.ts
  render/
    MarkdownRenderer.ts   the only module that knows markdown exists
    FeedGenerator.ts      RSS
    plugins/katex.ts      build-time math
  layouts/
    Layout.ts           abstract: owns <head>, nav, toggle, footer
    HomeLayout.ts  PageLayout.ts  PostLayout.ts
    ArchiveLayout.ts  TagLayout.ts  TagIndexLayout.ts
    partials.ts         markup shared between layouts
  html/
    html.ts             escaped-by-default templating
    icons.ts            inline SVG contact icons
    theme.ts            the toggle, and the site's only JavaScript
  assets/AssetPipeline.ts   copying, cleaning, writing
  util/                 dates, slugs, text, logging
```

Two ideas do most of the work.

**`Layout` owns the page shell.** The `<head>`, navigation, and footer are
written once in the abstract base. A subclass supplies only its metadata and
the markup inside `<main>`. Adding a meta tag or a footer link changes every
page on the site without touching a subclass.

**Templates are typed functions, not a template language.** The `html`
tagged-template escapes every interpolated value unless you wrap it in `raw()`,
and because templates are ordinary TypeScript, a typo in a property name is a
compile error rather than a silently empty element.

## Adding a page type

1. Subclass `Layout`; implement `get meta()` and `renderMain()`.
2. Render it from `SiteBuilder`, giving it a URL from `SitePaths`.

Nothing else needs to change.

## Deploying

**GitHub Pages** - already wired up. In the repository, set
*Settings → Pages → Source* to **GitHub Actions**, then push to `main`. The
workflow in `.github/workflows/deploy.yml` type-checks, builds, and publishes.

**Vercel** - import the repository and set:

- Build command: `npm run build`
- Output directory: `dist`

Either way, update `url` in `site.config.ts` to the domain you end up on, since
that's what canonical links and the RSS feed are built from.

## Dependencies

| Package | Why |
| --- | --- |
| `markdown-it` | Markdown parsing |
| `gray-matter` | Front matter |
| `katex` | Math, rendered at build time |
| `shiki` | Syntax highlighting, at build time |

Plus `typescript`, `tsx`, and `typedoc` for development. The published site
loads no JavaScript beyond the inlined theme toggle - highlighting and math are
both resolved at build time.
