# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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

### Added (late 0.3.0 round)

- Sage execution path verified: miniforge `sage=10.9` env installed; the
  sagemath-skill runner works via SAGE_PYTHON with Python-form syntax
  (preparser constructs like `x^2` are correctly rejected per the contract).
  Search works without the binary; execution requires it.

- `verymath_research_gate`: three-gate validation for Co-Mathematician-style
  research workspaces (goal approval / workstream completion / final render),
  ported from the documented upstream file contract (report.md mandatory
  sections, independent-reviewer rule, blocking-review resolution).
- `verymath_sage_check` / `verymath_sage_search`: clean-room TypeScript corpus
  search over the separately-distributed CC BY-SA SageMath docs (route-a).
- `verymath_osqp_check` / `verymath_osqp_solve`: OSQP stack probe + JSON
  contract QP solving with independent verification.
- Bundled skills: `osqp-solver`, `mixed-integer-programming` (repaired),
  `matlab-runner`, `math-beamer`.

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
- **12 model-facing tools**: `verymath_glossary_query`, `verymath_glossary_upsert`,
  `verymath_glossary_build`, `verymath_python_check`, `verymath_osqp_check`,
  `verymath_osqp_solve`, `verymath_ocr_scan`, `verymath_lean_detect_sorry`,
  `verymath_paper_validate`, `verymath_paper_graph` (+ `focus` closure),
  and the paper-graph engine.
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
