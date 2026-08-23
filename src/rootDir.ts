/**
 * The repository root.
 *
 * This lives in its own module, on its own, for a specific reason: `index.ts`
 * runs a build as soon as it is imported, so anything that pulls `ROOT_DIR`
 * from there would kick off a build merely by asking where the repo is. The
 * scripts in `scripts/` need this value without that side effect.
 *
 * Derived from this file's own location rather than `process.cwd()`, so every
 * entry point resolves the same root no matter which directory it was invoked
 * from - including from an editor task or a git hook.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Absolute path to the repository root.
 *
 * @remarks
 * All relative paths in `site.config.ts` resolve against this.
 */
export const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
