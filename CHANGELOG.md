# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.3.0] - 2026-10-15

### Added

- Bundled skills `graph-theory-paper-reading` (proof-tree LaTeX reports) and
  `after-ocr` (OCR Markdown review discipline) adapted from VeryMath
  AI4Math-Paper-Reading, with DSH integration notes.
- `verymath_ocr_scan`: deterministic OCR error-candidate locator bridging the
  bundled `scan_markdown_ocr.py` (pure stdlib; candidates only — the after-ocr
  line-by-line protocol still applies).
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
