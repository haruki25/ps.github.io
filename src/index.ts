/**
 * Build entry point - `npm run build`.
 *
 * Responsibilities are limited to the things a command-line program owns:
 * reading flags, resolving the repository root, reporting a summary, and
 * choosing an exit code. All the actual work belongs to {@link SiteBuilder}.
 */

import config from '../site.config.js';
import { SiteBuilder } from './SiteBuilder.js';
import { Logger } from './util/Logger.js';
import { FrontMatterError } from './content/FrontMatter.js';
import { ROOT_DIR } from './rootDir.js';

/** Run one build and report on it. */
async function main(): Promise<void> {
  const includeDrafts = process.argv.includes('--drafts');
  const logger = new Logger();

  logger.info(`Building ${logger.emphasise(config.title)}...`);
  if (includeDrafts) logger.detail('including drafts');

  const builder = await SiteBuilder.create(config, {
    rootDir: ROOT_DIR,
    includeDrafts,
    logger,
  });

  const result = await builder.build();

  logger.success(
    `Built ${result.filesWritten} files in ${result.durationMs}ms ` +
      `(${result.postCount} posts, ${result.pageCount} pages, ${result.tagCount} tags)`,
  );

  if (result.warnings.length > 0) {
    logger.info(`Finished with ${result.warnings.length} warning(s).`);
  }
}

main().catch((error: unknown) => {
  const logger = new Logger();

  // Front matter problems are the author's typo, not a crash: show the message
  // without a stack trace, which would only bury the useful line.
  if (error instanceof FrontMatterError) {
    logger.error(error.message);
  } else {
    logger.error('Build failed.');
    console.error(error);
  }

  process.exitCode = 1;
});
