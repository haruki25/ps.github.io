/**
 * Local preview server - `npm run dev`.
 *
 * Builds the site (including drafts), serves `dist/` over HTTP, and rebuilds
 * whenever anything under `content/` or `assets/` changes. Refresh the browser
 * to see the change; there is no live-reload socket, deliberately, because it
 * would mean injecting a script tag into the very pages we are trying to keep
 * script-free.
 *
 * Editing files under `src/` changes the generator itself. Those are picked up
 * on restart rather than live, because the already-imported modules are cached
 * for the life of the process - the server says so when it notices.
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

import config from '../site.config.js';
import { ROOT_DIR } from '../src/rootDir.js';
import { SitePaths } from '../src/config/SitePaths.js';
import { SiteBuilder } from '../src/SiteBuilder.js';
import { Logger } from '../src/util/Logger.js';
import { FrontMatterError } from '../src/content/FrontMatter.js';

/**
 * Port to listen on; override with `PORT=8080 npm run dev`.
 *
 * 4000 rather than the more conventional 3000 because 3000 is heavily
 * contested - Rails, Next.js, Grafana and ntopng all want it by default.
 */
const DEFAULT_PORT = 4000;

/**
 * How many consecutive ports to try before giving up.
 *
 * Only applies when the port was not chosen explicitly: if you asked for a
 * specific port and cannot have it, silently using a different one would be
 * unhelpful, so that case fails loudly instead.
 */
const PORT_SEARCH_ATTEMPTS = 10;

const EXPLICIT_PORT = process.env['PORT'];
const PORT = Number(EXPLICIT_PORT ?? DEFAULT_PORT);

/** How long to wait for the filesystem to settle before rebuilding. */
const DEBOUNCE_MS = 120;

/**
 * Content types by file extension.
 *
 * Only the types this site actually emits are listed; anything else is served
 * as a binary download rather than guessed at.
 */
const CONTENT_TYPES = new Map<string, string>([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'],
  ['.woff', 'font/woff'],
  ['.ttf', 'font/ttf'],
]);

const logger = new Logger();
const paths = new SitePaths(config, ROOT_DIR);

/**
 * Run one build, reporting failures without killing the server.
 *
 * A dev server that exits on a bad date in front matter would be maddening:
 * you would have to restart it every time you mistyped something. Instead the
 * error is printed and the previously built site stays up.
 */
async function runBuild(): Promise<void> {
  let builder: SiteBuilder | undefined;
  try {
    builder = await SiteBuilder.create(config, {
      rootDir: ROOT_DIR,
      includeDrafts: true,
      logger,
    });
    const result = await builder.build();
    logger.success(
      `Rebuilt ${result.filesWritten} files in ${result.durationMs}ms`,
    );
  } catch (error) {
    if (error instanceof FrontMatterError) {
      logger.error(error.message);
    } else {
      logger.error('Build failed; serving the previous version.');
      console.error(error);
    }
  } finally {
    // Release the syntax highlighter even when the build threw, or a long dev
    // session leaks one per rebuild.
    builder?.dispose();
  }
}

/** True while a build is running, so a second one cannot start on top of it. */
let buildInFlight = false;

/** Set when a change arrives mid-build; triggers exactly one more build after. */
let rebuildRequested = false;

/**
 * Request a rebuild, guaranteeing that only one runs at a time.
 *
 * @remarks
 * The debounce in {@link watch} collapses the burst of events a single save
 * produces, but it cannot prevent a *new* burst arriving while a build is still
 * running - and two watchers fire independently. Without this guard, one
 * build's `clean()` deletes the output directory while another is writing into
 * it, which fails as `EPERM: rmdir` on Windows, `EEXIST: mkdir` elsewhere, or
 * as a corrupted syntax-highlighter grammar.
 *
 * Overlapping requests are coalesced rather than queued: any number of changes
 * arriving during a build result in exactly one more build, because that build
 * will read the final state of every file anyway.
 */
async function requestRebuild(): Promise<void> {
  if (buildInFlight) {
    rebuildRequested = true;
    return;
  }

  buildInFlight = true;
  try {
    do {
      rebuildRequested = false;
      await runBuild();
    } while (rebuildRequested);
  } finally {
    buildInFlight = false;
  }
}

/**
 * Map a request URL to a file inside `dist/`.
 *
 * Returns `null` for anything that escapes the output directory. Without that
 * check a request for `/../../etc/passwd` would be served happily.
 */
function resolveRequestPath(requestUrl: string): string | null {
  // Strip the query string and decode percent-escapes before touching the path.
  const withoutQuery = requestUrl.split('?')[0] ?? '/';
  let decoded: string;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    return null;
  }

  // Route through SitePaths rather than joining onto the output directory
  // directly, so the dev server honours `basePath` exactly as the built site
  // does. GitHub serves this repository from a subdirectory, so every URL in
  // the HTML carries that prefix while the files on disk do not. Resolving by
  // hand here would serve the pages but 404 every stylesheet and link.
  //
  // A request without the prefix still resolves, so both of these work:
  //   /ps.github.io/bio.html  ->  dist/bio.html
  //   /bio.html               ->  dist/bio.html
  const resolved = paths.outputFileFor(decoded);

  // `path.join` inside outputFileFor has normalised any `..` segments by now,
  // so a simple prefix test is sufficient to keep requests inside dist/.
  const root = path.resolve(paths.outputDir);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;

  return resolved;
}

/** Serve one request out of `dist/`. */
async function handleRequest(
  request: http.IncomingMessage,
  response: http.ServerResponse,
): Promise<void> {
  const filePath = resolveRequestPath(request.url ?? '/');

  if (filePath === null) {
    response.writeHead(400, { 'content-type': 'text/plain' });
    response.end('Bad request');
    return;
  }

  try {
    const stats = await fs.stat(filePath);
    // A bare directory request without a trailing slash still gets its index.
    const target = stats.isDirectory()
      ? path.join(filePath, 'index.html')
      : filePath;

    const body = await fs.readFile(target);
    const type =
      CONTENT_TYPES.get(path.extname(target).toLowerCase()) ??
      'application/octet-stream';

    response.writeHead(200, {
      'content-type': type,
      // Never cache during development, or edits appear not to have worked.
      'cache-control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    response.end(
      '<!DOCTYPE html><meta charset="utf-8"><title>404</title>' +
        '<p style="font:16px system-ui;padding:2rem">404 - not found in <code>dist/</code>.</p>',
    );
  }
}

/**
 * Watch a directory, calling `onChange` after activity settles.
 *
 * Editors often write a file in several steps (write, rename, touch), which
 * fires multiple events for what the author experiences as one save. The
 * debounce collapses those into a single rebuild.
 */
function watch(directory: string, onChange: () => void): void {
  if (!fsSync.existsSync(directory)) return;

  let timer: NodeJS.Timeout | undefined;
  fsSync.watch(directory, { recursive: true }, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, DEBOUNCE_MS);
  });
}

/**
 * Start listening on one port.
 *
 * `server.listen` reports failure by emitting an `error` event rather than
 * throwing, and an unhandled `error` event crashes the process. Wrapping it in
 * a promise turns that into a rejection we can actually react to.
 */
function listenOnce(server: http.Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException): void => {
      server.removeListener('listening', onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.removeListener('error', onError);
      const address = server.address();
      // `address()` returns a string only for a Unix socket, which we never use.
      resolve(typeof address === 'object' && address !== null ? address.port : port);
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port);
  });
}

/**
 * Find a free port, starting at `startPort`.
 *
 * Something else already using the default port is an everyday occurrence, not
 * an error worth stopping for - so we step to the next one and say so. A port
 * the user named explicitly is never substituted.
 */
async function startServer(server: http.Server, startPort: number): Promise<number> {
  const attempts = EXPLICIT_PORT === undefined ? PORT_SEARCH_ATTEMPTS : 1;

  for (let offset = 0; offset < attempts; offset++) {
    const port = startPort + offset;
    try {
      return await listenOnce(server, port);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error;
      logger.warn(`Port ${port} is already in use.`);
    }
  }

  const tried =
    attempts === 1
      ? `port ${startPort}`
      : `ports ${startPort}-${startPort + attempts - 1}`;
  throw new Error(
    `Could not listen on ${tried}. ` +
      'Free one up, or choose another with: PORT=8080 npm run dev',
  );
}

async function main(): Promise<void> {
  await requestRebuild();

  const server = http.createServer((request, response) => {
    handleRequest(request, response).catch((error: unknown) => {
      logger.error('Request failed.');
      console.error(error);
      if (!response.headersSent) response.writeHead(500);
      response.end();
    });
  });

  const port = await startServer(server, PORT);

  logger.info('');
  // Include the base path, so the printed URL is the one that actually works.
  // With a base path configured, the bare origin serves the home page but its
  // stylesheet and links all sit under the prefix.
  const siteUrl = `http://localhost:${port}${paths.homeUrl}`;
  logger.success(`Serving ${logger.emphasise(siteUrl)}`);
  logger.detail('drafts are included; edits to content/ rebuild automatically');
  logger.detail('press Ctrl+C to stop');

  // Content and assets rebuild live.
  watch(paths.contentDir, () => {
    logger.info('');
    logger.info('Change detected, rebuilding...');
    void requestRebuild();
  });
  watch(paths.assetsDir, () => {
    logger.info('');
    logger.info('Assets changed, rebuilding...');
    void requestRebuild();
  });

  // Generator source cannot be hot-reloaded; say so rather than silently
  // serving stale output.
  watch(path.join(ROOT_DIR, 'src'), () => {
    logger.warn('src/ changed - restart "npm run dev" to pick it up.');
  });
}

main().catch((error: unknown) => {
  logger.error('Dev server failed to start.');
  console.error(error);
  process.exitCode = 1;
});
