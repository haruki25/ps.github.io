/**
 * Everything that gets copied into the output rather than generated into it.
 *
 * Two jobs:
 *   1. mirror `assets/` (stylesheet, favicon, any images) into `dist/`;
 *   2. vendor KaTeX's stylesheet and fonts into `dist/vendor/katex/`, so that
 *      pages with math have no external dependency at all.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

import type { SitePaths } from '../config/SitePaths.js';

/**
 * Resolve paths inside installed packages.
 *
 * `import.meta.resolve` would also work, but `createRequire` is stable across
 * every Node version this project supports and needs no flags.
 */
const require = createRequire(import.meta.url);

/**
 * All filesystem writes the build performs.
 *
 * @remarks
 * Clearing the output directory, copying static assets, vendoring KaTeX, and
 * writing generated pages all funnel through here, so the mkdir-then-write
 * dance exists in exactly one place.
 */
export class AssetPipeline {
  /**
   * @param paths - Resolved input and output directories.
   */
  constructor(private readonly paths: SitePaths) {}

  /**
   * Delete and recreate the output directory.
   *
   * Building into a cleared directory is what guarantees that renaming or
   * deleting a post actually removes its page, instead of leaving an orphan
   * behind that stays reachable forever.
   */
  async clean(): Promise<void> {
    await fs.rm(this.paths.outputDir, { recursive: true, force: true });
    await fs.mkdir(this.paths.outputDir, { recursive: true });
  }

  /** Copy `assets/` into the output directory, preserving its structure. */
  async copyStaticAssets(): Promise<void> {
    try {
      await fs.access(this.paths.assetsDir);
    } catch {
      // No assets directory is unusual but not fatal.
      return;
    }
    await fs.cp(this.paths.assetsDir, this.paths.outputDir, {
      recursive: true,
    });
  }

  /**
   * Copy KaTeX's stylesheet and web fonts into `dist/vendor/katex/`.
   *
   * Only `.woff2` files are copied. KaTeX ships each face three times over
   * (woff2, woff, ttf) for the sake of long-dead browsers; every browser that
   * supports the CSS this site relies on also supports woff2, so shipping the
   * other two formats would roughly triple the font payload for no one.
   *
   * @returns the number of font files copied.
   */
  async copyKatexAssets(): Promise<number> {
    const katexDist = path.dirname(require.resolve('katex/dist/katex.min.css'));
    const targetDir = path.join(this.paths.outputDir, 'vendor', 'katex');
    const targetFontDir = path.join(targetDir, 'fonts');

    await fs.mkdir(targetFontDir, { recursive: true });

    await fs.copyFile(
      path.join(katexDist, 'katex.min.css'),
      path.join(targetDir, 'katex.min.css'),
    );

    const fontDir = path.join(katexDist, 'fonts');
    const fontFiles = (await fs.readdir(fontDir)).filter((name) =>
      name.endsWith('.woff2'),
    );

    await Promise.all(
      fontFiles.map((name) =>
        fs.copyFile(
          path.join(fontDir, name),
          path.join(targetFontDir, name),
        ),
      ),
    );

    return fontFiles.length;
  }

  /**
   * Write one generated file, creating parent directories as needed.
   *
   * Every page in the site goes through here, which keeps the mkdir-then-write
   * dance in a single place.
   */
  async writeFile(outputPath: string, contents: string): Promise<void> {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, contents, 'utf8');
  }
}
