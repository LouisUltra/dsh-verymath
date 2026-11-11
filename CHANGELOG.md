# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.7.1] - 2026-11-11

### Fixed

- **The panel and the tools could disagree about the same machine.** The
  environment tab spawned a bare `sage`, while `verymath_sage_check` resolved it
  through the conda environment directories — so a machine with
  `~/.verymath/miniforge/envs/sage` showed "SageMath missing" in the panel and
  "available" in the tool. Executable discovery now lives in `core/exec.ts` and
  both surfaces use it; `tool` re-exports the same functions for compatibility.
- Panel writes used `writeFile`, which truncates before writing: a concurrent
  reader (the panel polling, or a chat tool call landing mid-write) could see a
  half-written document and report "not a valid glossary". Writes now go through a
  sibling temp file plus `rename`.
- The environment probe ran its seven checks sequentially, so the tab could sit on
  "probing…" for up to twenty seconds and read as a hang. The independent probes
  now run concurrently.
- The read route and the write routes returned two different `stats` shapes; both
  now use one `glossaryStats`, so the panel's counters do not jump after an edit.

## [0.7.0] - 2026-11-11

### Added

- **The glossary tab is an editor, not a viewer.** Editing a translation was the
  one thing the panel could do better than the chat, and 0.6.0 could only read.
  Per term you can now edit `cn`/`pos`/`field`/`source`/example, add a term, or
  delete a row — with the same rules the tool enforces: a row is addressed by
  `term_id` for corrections, a new translation of an existing English term
  becomes an `en__N` alias row instead of overwriting, ambiguous or unknown
  targets are refused with the core's own message, and a delete re-sorts with
  contiguous `idx`. Writes go through `/api/verymath/glossary/{upsert,delete}`,
  are confined to the workspace, and are serialized per document so two quick
  edits cannot drop one another.
- Coverage gaps became a to-do list: the tab reports how many terms lack an
  example sentence or a subfield and names them, instead of only counting.
- **The dependency graph is interactive.** The route now returns laid-out
  coordinates and edges instead of a pre-rendered SVG string, and the client
  draws it with real elements: clicking a node shows its statement, in/out
  degree, whether it is a hub or supports a main theorem, and its immediate
  relations; clicking again clears it. This also removes the panel's only use of
  `dangerouslySetInnerHTML`.
- The environment tab gained copy-to-clipboard for each install hint and a
  one-click Markdown report of the whole probe result.

### Changed

- `pyrightconfig.json` excludes `skills/`: every Python file in this package is
  vendored from upstream and recorded verbatim in `UPSTREAM.json`, so type
  checking it reports upstream's own `openpyxl` stub complaints and invites edits
  that would break provenance. The scripts are exercised by the upstream suite
  (19 tests) and by real runs, not by pyright.

## [0.6.0] - 2026-11-11

### Added

- **The panel is a real panel.** 0.5.0 shipped the sidebar entry with a static
  list of tool names — an entry that proved the wiring, not a deliverable. This
  release replaces it with four tabs backed by host routes that run the same core
  code as the tools:
  - **环境** — probes the local toolchain for real (Python 3, PyYAML, latexmk,
    xelatex, the OSQP stack, SageMath, Lean) and shows, per row, what the
    capability unlocks, the detected version, or the install command. A readiness
    count answers "will this work on my machine" without trying a task first.
  - **术语库** — picks any `glossary*.json` in the workspace (bounded scan), shows
    term/example/alias/subfield counts, and searches by English, Chinese,
    `term_id` or subfield with the same matching order the tool uses, including
    example sentences for disambiguation.
  - **论文图** — picks any `*_structure.json`, renders the theorem dependency
    graph as an inline SVG (layered by the bottom-up reproduction order, coloured
    by entity kind, thicker border for shared hubs), and reports topology:
    hubs, cycles, isolated nodes, both reading directions, per-entity in/out
    degree, plus a focus box that shows one theorem's transitive closure and
    reading layers.
  - **技能** — the 16 bundled skills with their descriptions, read from the
    package the same way the host skill registry reads them.
- `src/http.ts`: six `/api/verymath/*` routes (`env`, `glossaries`, `glossary`,
  `structures`, `paper`, `skills`). Each is registered through
  `connection.fetch.register` with an explicit `requestBody: 'buffered'`, and
  every failure becomes structured JSON so the panel shows a sentence instead of
  an empty 500. Paths are confined to the workspace; escaping paths are refused
  with 400.
- The root entry now registers those routes via `ctx.inject(['connection'], …)`.
  When a host has no connection service (headless, CLI) the panel half simply
  degrades away — the tools and skills are unaffected.
- `tests/tool/http.spec.ts` (10 cases): every route the panel calls is registered
  and returns its documented shape; workspace escape and non-glossary input are
  client errors, not 500s; the paper route returns topology plus an SVG that
  actually contains the entity labels.

@@## [0.5.0] - 2026-11-11

### Added

- **Browser panel with a left-sidebar entry.** The plugin now ships a client half
  (`dsh.client` + `lib/client.js`), so hosts that compose client plugins (DSH web,
  EduWork desktop) show a 「数学科研」 row in the left sidebar; clicking it opens a
  panel listing the 14 tools and how to reach the capabilities. Until now the
  package was tools-and-skills only, which is why it had no entry anywhere while
  a plugin with a client half (e.g. wellspring) did.
  - The entry registers on `sidebar.panellist` (`kind: list`, root scope) with
    `id: 'verymath'`, and the panel registers on the layout's `main` slot
    (`kind: keyed`, root scope) with `key: 'verymath'` — the sidebar resolves the
    panel by that id, so the two must stay in sync.
  - `cordis.patch.yml` gains a **bare-package-name** entry (`verymath-client`).
    The host resolves a client plugin's manifest from the loader entry name; with
    only `/core` and `/tool` entries the specifier lookup returns undefined, so
    `dsh.client` would never be read. The root module (`src/index.ts`) therefore
    became a mountable no-op plugin alongside its existing re-exports.
  - `scripts/build-client.mjs` copies `client/verymath.js` to `lib/client.js` and
    fails the build when the bundle id does not match `package.json.name` or the
    source does not parse — the host only shows a one-line error when a client
    bundle fails to load, so this check is cheaper than debugging in the app.

## [0.4.0] - 2026-11-11

Minor rather than patch: `verymath_glossary_upsert` changes what it does with a
request that omits `term_id` and supplies a different translation for an
existing English term (overwrite → additional alias row). The data-loss fix
below cannot be made without that change, and a patch number would understate
it.

### Fixed

- **`verymath_glossary_upsert` destroyed translations of polysemous terms.** The
  upstream contract stores a second translation of the same English term as a
  separate alias row (`term_id` `<en>__N`), and the bundled
  `glossary_build.py` produces exactly that. The tool never created alias rows:
  it used the lowercased English term as the only identity, so upserting
  `group / 分组` against a document holding `group / 群` plus `group__1 / 分组`
  rewrote the primary row and left two rows carrying the same translation, with
  群 gone. Upserts now resolve identity as: an explicit `term_id` (correction of
  one row), else the exact `(en, cn)` pair (idempotent re-add), else a new row
  whose id continues the upstream sequence (`<en>`, `<en>__1`, `<en>__2`, …),
  skipping ids other rows already use. See "Changed" for the intent split this
  introduces.
- `verymath_paper_graph` returned an empty `topDownOrder` and reported
  `supportsMainTheorem: false` for every entity whenever `extraPaths` merged
  more than one batch artifact. Batch merging unions `entities` only, so the
  `main_theorems` the reading directions are rooted at were dropped; the same
  applied to `focus` when the target theorem appeared only in `main_theorems`.
  Main theorems are now collected across all merged artifacts.
- `verymath_glossary_query` labelled an exact Chinese match as `matchedBy: 'en'`,
  so a query for 流形 reported an English-field hit.
- `verymath_sage_check` spawned a bare `sage`. A conda-installed SageMath is not
  on the `PATH` a desktop app inherits (a macOS app launched from Finder reads no
  login shell profile), so the probe reported SageMath missing on machines that
  have it. Resolution is now explicit and documented: `VERYMATH_SAGE` (an
  absolute path) wins, then `PATH`, the TeX/conda base directories, and
  `<conda root>/envs/<name>/bin` for the known roots — including this package's
  own documented layout `~/.verymath/miniforge`, so the recommended
  `conda create -n sage sage=10.9` environment is found. The search is
  SageMath-only; it is not added to the generic executable path used by the TeX
  probe.
- `verymath_glossary_upsert` read the document from the query cache. A glossary
  edited by the user or by the bundled `glossary_web.py` could therefore be
  overwritten from a stale snapshot; the write path now re-reads from disk, and
  concurrent upserts on one document are serialized so the later write cannot
  drop the earlier one. The lock is keyed on the document's canonical identity
  (`fs.resolve` + `processPath`), not the model-supplied string, so a relative
  path and an absolute path to the same file cannot run in parallel. Scope: this
  runtime only — an external editor, a bundled Python script or another DSH
  process does not take the lock.
- Only a genuine `ENOENT` is now treated as "this glossary does not exist yet".
  Every read failure used to map to `VERYMATH_GLOSSARY_UNAVAILABLE`, which the
  upsert tool interpreted as "start an empty glossary" — a permission or I/O
  error could therefore replace a real document with only the terms in that one
  request. Other failures surface as `VERYMATH_IO`, and cancellation propagates.
- `upsertTerms` built its id map before validating the input, so a document with
  duplicate `term_id`s was silently collapsed and the closing invariant check
  could no longer see the loss. Invariants are validated first.
- `verymath_paper_graph` rejected the upstream batch protocol. Each artifact was
  validated on its own, so a later batch citing a label an earlier batch defined
  failed with "depends on unknown label" before the merge could run. Artifacts
  are now validated as a group against the merged label set: cross-batch edges
  are accepted, genuinely dangling ones are still rejected.
- `verymath_paper_graph` rendered only the first artifact in Mermaid while the
  counts described every merged batch. The render now uses the merged structure.
- `verymath_paper_graph` dropped a main theorem recorded only in `main_theorems`
  (no matching entity) from the top-down order, contradicting `focus`, which
  resolved the same theorem. Both directions now agree.
- `verymath_glossary_build` invalidated the query cache for the path it could
  parse out of `--output`. That key was the raw argument, while queries cache the
  resolved absolute path, so the invalidation never matched and a later query
  could serve the document from before the build. Script runs now drop the whole
  glossary cache.
- Probe timers are cleared when a probe settles; an uncleared timer kept the
  event loop alive for the rest of the timeout after the answer was known.

### Internal hardening (defects introduced and fixed within this release)

These were never present in a published version. They are listed so the review
history is honest, not because any user could have hit them.

- The `(en, cn)` lookup key joined the two strings with `\u0000`. JSON strings may
  contain that character, so `en="a", cn="b\u0000c"` and `en="a\u0000b", cn="c"`
  produced one key and the second request could overwrite a row belonging to a
  different English term. The key is JSON-encoded now.
- Alias id allocation could hang the host. A `number` counter derived from
  existing suffixes meant an id such as `group__9007199254740992` made
  `occurrence + 1 === occurrence`, so the allocation loop never advanced —
  synchronously, freezing the event loop instead of failing. The counter is a
  `BigInt`, and the suffix bound is applied to both parsing and emitting so the
  allocator never produces an id it would refuse to read back.
- Invalidation after an upsert covered only the paths that call knew about, so a
  query issued earlier through a symlink alias could keep serving the pre-write
  document. A successful upsert now clears the glossary cache.

### Changed

- **Behavior change in `verymath_glossary_upsert`.** A request that omits
  `term_id` and supplies a different translation for an existing English term
  used to overwrite the existing translation in place; it now adds an alias row
  and keeps the existing translation. To change a translation, query the term
  and pass the returned `term_id`. Requests are rejected (no write) when:
  `term_id` is blank or unknown, the `term_id` belongs to a different English
  term, the `(en, cn)` pair is already held by another row, or an id-less
  request matches several rows. `en` is never rewritten by this tool, so
  renaming a term is not supported. Migration for a script that relied on the
  overwrite: add `term_id: '<the id you meant>'` to the request.
- `TermUpsert` gained the optional `term_id` field; the model-facing
  `verymath_glossary_upsert` schema, its description and the `math-glossary`
  skill gained the matching "add alias vs correct a row" guidance. The tool
  descriptions state that `en` must match the target row and is not renamed.
- `parsePaperStructure` takes an optional `deferDependencyCheck`; new exports
  `parsePaperBatch` (validate artifacts as a group) and `collectMainTheorems` /
  `mergeStructures` in the graph module.

### Added

- Regression tests for the glossary write contract (alias creation, correction by
  `term_id`, gap/skip id allocation, oversized suffixes, `(en, cn)` key encoding,
  ambiguity, unknown/blank id, duplicate ids in the input, cache and lock
  behaviour), for batch reading directions, and for SageMath resolution:
  **107 → 146 specs**.
- The runtime probe now exercises the tool contract rather than only the core
  functions: upsert alias creation and correction by `term_id`, an unknown
  `term_id` rejected without writing, a batch whose later request is invalid
  writing nothing, cache invalidation reaching a symlink alias, concurrent
  writes through a path alias, batch paper-graph merging (cross-batch dependency
  accepted, batched main theorem driving the top-down order, every merged entity
  in the Mermaid render), a main theorem recorded only in `main_theorems`
  resolving in both reading directions, and a dependency missing from every batch
  still rejected: **8 → 16 probe checks**.

## [0.3.3] - 2026-11-08

### Fixed

- The package root entry did not exist: `main`, `types` and `exports["."]`
  all pointed at `lib/index.js`, but there was no `src/index.ts`, so `tsc`
  only ever emitted `lib/core/` and `lib/tool/`. The file was missing from the
  published 0.3.0, 0.3.1 and 0.3.2 tarballs, so `import '@louisultra/dsh-verymath'`
  failed for anyone using the package by name. DSH loads the `./core` and
  `./tool` subpaths, which is why this never showed up in use. A re-export-only
  entry is added and verified to be inside the packed tarball.
- `verymath_beamer_check` shelled out to `/usr/bin/which` and
  `/Library/TeX/texbin/kpsewhich`. The former does not exist on Windows and the
  latter is a macOS-only directory, so a Linux or Windows host reported a
  missing TeX toolchain even with TeX installed. Binaries are now resolved
  in-process by scanning `PATH` (honouring `PATHEXT` on Windows) and falling
  back to the distribution's own bin directory, which is what a desktop app
  launched from Finder needs because it does not inherit the login shell
  `PATH`. `kpsewhich` is resolved the same way instead of assuming a fixed
  location. Covered by five new tests.

### Changed

- Development dependencies moved to DSH `0.2.2-rc.1`, cordis `4.1.0` and
  schemastery `3.19.0`, matching the version EduWork 0.4.13 bundles. The
  runtime probe is now the dual-version variant: it mounts
  `dsh-tool-executor-native` when present and drives the 0.2.2 batch
  `ctx.tools.execute` API, falling back to the 0.2.1 single-call shape
  otherwise. `npm run test:runtime` therefore exercises the host version that
  users actually run rather than the previous 0.2.0-rc.2 pin.
- Two unreferenced development dependencies that conflicted with cordis 4.1.0
  (`cordis-plugin-include`, `cordis-plugin-loader`) are removed.
- `engines.node` raised to `>=24.22.1` and the peer range starts at
  `0.2.1-rc.5`, matching what is actually tested.

### Documentation

- The skill table in both READMEs listed 15 of the 16 bundled skills; it was
  missing `osqp-solver`, which the tool table already documented.
- `docs/integration-matrix.md` is repository research material that `files`
  deliberately excludes, but the READMEs linked it by relative path, so the
  link was broken in an installed package. It now points at the repository URL
  and says it is not shipped.
- `docs/glossary-coverage-gap.md` listed 68 tests; the suite has 107.

## [0.3.2] - 2026-10-19

### Fixed

- `verymath_research_gate` `goal_approval`: the `details` payload carried an
  `undefined` `goalId`, which the tool output contract rejects as
  "value is not lossless JSON" whenever the gate ran without an explicit
  goalId. Found by a real run during capability-example verification; covered
  by two regression tests.
- `lean-formalization` DSH notes referenced `verymath_lean_review` and
  `verymath_lean_check`, which do not exist; patch review and environment
  checks go through the bundled `ai4m_lean.py` script instead.

### Added

- `docs/capability-examples.md`: all 14 capabilities documented with the
  five-field scenario structure and real verification records (macOS).

## [0.3.1] - 2026-10-16

### Added

- `verymath_beamer_check`: TeX toolchain probe for the math-beamer skill
  (latexmk, xelatex, forest/ctex packages via kpsewhich; per-piece detail +
  install hint, installs nothing) — closes the README's promised next step.
- Paper-to-skill appendix (review decision): `proof_pattern_taxonomy.md` +
  `quality_rubric.md` copied verbatim into `math-paper-reading/references/`
  as deep-read references; L3 consults the proof-pattern taxonomy, L4 can
  score methods with the quality rubric. The full paper-to-skill chain
  stays unbundled (MinerU cloud-API privacy).

### Fixed

- MATLAB desktop-attachment status: the earlier "existing/auto modes crash"
  claim was a test-client framing artifact (Content-Length framing vs the
  MCP newline-delimited JSON stdio contract), not a server bug. Clean
  reproduction with the official dsh-mcp-client shows desktop attach works
  on v0.14.0 and v0.12.0; docs corrected (`docs/matlab-connection-status.md`).
  The matlab-runner skill now documents the desktop-attach execution path.

### Added (0.3.1 round — tools and skills)

- Sage environment note: miniforge `sage=10.9` installed on the development
  machine; the upstream runner works via `SAGE_PYTHON` with Python-form
  syntax (preparser constructs like `x^2` are correctly rejected per the
  contract). This package exposes corpus search only; running Sage code is
  the user's own environment.

- `verymath_research_gate`: three-gate validation for Co-Mathematician-style
  research workspaces (goal approval / workstream completion / final render),
  ported from the documented upstream file contract (report.md mandatory
  sections, independent-reviewer rule, blocking-review resolution).
- `verymath_sage_check` / `verymath_sage_search`: clean-room TypeScript corpus
  search over the separately-distributed CC BY-SA SageMath docs (the
  Sagemath-skill repository itself is GPLv3 and is not bundled).
- `verymath_osqp_check` / `verymath_osqp_solve`: OSQP stack probe + JSON
  contract QP solving with independent verification.
- Bundled skills: `osqp-solver`, `mixed-integer-programming` (repaired),
  `matlab-runner`, `math-beamer` (23 template packs).

## [0.3.0] - 2026-10-15

### Added

- **13 bundled skills** covering the six issue-#152 directions:
  - Paper reading: `math-paper-reading` (v4.2), `graph-theory-paper-reading`,
    `after-ocr` (all from AI4Math-Paper-Reading).
  - Glossary: `math-glossary` (AI4Math-MathTool v0.1.0).
  - Writing: `paper-writing` with six flattened sub-skill modules
    (AI4Math-Writing).
  - Research workflow: `discover-math-problems`, `proof-blueprint-review`,
    `open-problem-research-pipeline` (AI4Math-Auto-Research).
  - Optimization: `osqp-solver` (AI4Math-Optimization).
  - Computation: `least-squares`, `invariant-computation`
    (AI4Math-Computational-Mathematics).
  - Formalization: `lean-formalization` (with embedded lean-runtime support
    layer), `lean-setup` (AI4Math-Lean-Agents).
- **10 model-facing tools**: `verymath_glossary_query`,
  `verymath_glossary_upsert`, `verymath_glossary_build`,
  `verymath_python_check`, `verymath_osqp_check`, `verymath_osqp_solve`,
  `verymath_ocr_scan`, `verymath_lean_detect_sorry`, `verymath_paper_validate`,
  `verymath_paper_graph` (with `focus` transitive closure and Mermaid
  rendering). `verymath_sage_check`/`verymath_sage_search`,
  `verymath_research_gate`, and `verymath_beamer_check` followed in the
  0.3.1 round (see above), bringing the current total to 14.
- Package-hygiene tests ported from upstream `test_course_skills.py`
  (no machine-local paths/secrets in skills, no tool caches).

### Fixed

- Glossary behavior gaps from the upstream contract: `verymath_glossary_upsert`
  documented in the skill's DSH tool table, translation-agent trigger restored,
  `requirements-ai.txt` shipped, exit 2/3 surfaced as structured outcomes
  (`needs-force` / `partial`) instead of exceptions.

## [0.2.0] - 2026-10-15

### Added

- `verymath_paper_graph`: deterministic dependency-graph engine (batch merge,
  cited_by rebuild, shared_node, cycles, both reading directions, focus
  transitive closure, degraded Mermaid rendering) — replaces the upstream
  model-generated Python scripts on the DSH path.
- `verymath_glossary_upsert`: invariant-preserving glossary read/write loop.
- Glossary query: example sentences and subfield disambiguation filter.

### Fixed

- Glossary cache is invalidated after `verymath_glossary_build` (stale reads).
- `total` in query results now counts deduplicated candidates before the limit.
- Bundled skills route to `verymath_paper_graph` first, keeping the Python
  script flow only as a non-DSH fallback.

## [0.1.0] - 2026-10-14

### Added

- VeryMath capability seam (`ctx.verymath`): glossary loading, validation,
  caching, bilingual querying, Python discovery, and script execution.
- Model-facing tools: `verymath_glossary_query`, `verymath_glossary_build`,
  `verymath_python_check`, and `verymath_paper_validate`.
- Bundled skills adapted from VeryMath: `math-glossary` (v0.1.0 upstream) and
  `math-paper-reading` (v4.2 upstream), registered through the DSH skill
  registry with directory resource bases.
- Paper-structure contract aligned with the upstream v4.2
  `<slug>_structure.json` schema, including dependency-integrity validation.
- Synthetic vitest suite plus a runtime probe against the real DSH
  `0.2.0-rc.2` plugin API surface.
