/**
 * Create a new post - `npm run new -- "My Post Title"`.
 *
 * Writes `content/posts/YYYY-MM-DD-slug.md` with the front matter already
 * filled in, so publishing is: run this, write markdown, commit.
 *
 * The date prefix on the filename is purely for humans: it keeps the directory
 * listing in chronological order. The URL is derived from the slug alone, so
 * `2026-08-23-hello-world.md` publishes at `/blog/hello-world.html`.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import config from '../site.config.js';
import { ROOT_DIR } from '../src/rootDir.js';
import { SitePaths } from '../src/config/SitePaths.js';
import { slugify } from '../src/util/slug.js';
import { Logger } from '../src/util/Logger.js';

/** Two-digit zero padding for date components. */
function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Quote a string for YAML.
 *
 * Double-quoting and escaping any embedded quote handles every title that
 * would otherwise break the front matter - colons, `#`, leading `-`, and so on.
 */
function yamlString(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

/** The starting content of a new post file. */
function template(title: string, isoDate: string): string {
  return `---
title: ${yamlString(title)}
date: ${isoDate}
tags: []
# description: A one-line summary used for search results and the RSS feed.
# draft: true   # uncomment to keep this out of the published site
---

Write here.
`;
}

async function main(): Promise<void> {
  const logger = new Logger();
  const title = process.argv.slice(2).join(' ').trim();

  if (title === '') {
    logger.error('Please give the post a title.');
    logger.info('  npm run new -- "The Title Of My Post"');
    process.exitCode = 1;
    return;
  }

  const slug = slugify(title);
  if (slug === '') {
    logger.error(
      `Could not derive a filename from ${yamlString(title)}. ` +
        'Try a title containing letters or numbers.',
    );
    process.exitCode = 1;
    return;
  }

  const paths = new SitePaths(config, ROOT_DIR);
  const now = new Date();
  const datePrefix = [
    now.getUTCFullYear(),
    pad2(now.getUTCMonth() + 1),
    pad2(now.getUTCDate()),
  ].join('-');

  const filePath = path.join(paths.postsDir, `${datePrefix}-${slug}.md`);

  // Never clobber an existing draft. `wx` fails if the file is already there,
  // which is safer than checking first and then writing.
  await fs.mkdir(paths.postsDir, { recursive: true });
  try {
    await fs.writeFile(filePath, template(title, now.toISOString()), {
      encoding: 'utf8',
      flag: 'wx',
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: unknown }).code === 'EEXIST'
    ) {
      logger.error(`That post already exists: ${filePath}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  logger.success(`Created ${logger.emphasise(path.relative(ROOT_DIR, filePath))}`);
  logger.detail(`it will publish at ${paths.postUrl(slug)}`);
  logger.detail('run "npm run dev" to preview it');
}

main().catch((error: unknown) => {
  new Logger().error('Could not create the post.');
  console.error(error);
  process.exitCode = 1;
});
