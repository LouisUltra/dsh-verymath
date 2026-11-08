/**
 * VeryMath capability plugin for DSH — package entry.
 *
 * The bundle mounts two modules through `cordis.patch.yml`:
 * `./core` (the `ctx.verymath` service: glossary, paper, graph, gates, Sage)
 * and `./tool` (the 14 model-facing tools). This module re-exports both so an
 * `import '@louisultra/dsh-verymath'` gets the same surface as the subpaths.
 *
 * Without this module the package root declared in `package.json` (`main`,
 * `types` and `exports["."]` → `lib/index.js`) is emitted by no build and
 * importing the package by name fails, even though DSH itself loads the
 * `./core` and `./tool` subpaths and therefore never noticed.
 *
 * Upstream: VeryMath AI4Math repositories (MIT). See NOTICE.md and
 * UPSTREAM.json for per-repository provenance.
 *
 * @module @louisultra/dsh-verymath
 */
export * as core from './core/index.ts'
export * as tool from './tool/index.ts'
