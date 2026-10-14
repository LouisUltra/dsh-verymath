# Notices

This package contains code and skill content adapted from third-party sources.

## VeryMath AI4Math-MathTool (`math-glossary`)

- Source: https://github.com/VeryMath/AI4Math-MathTool
- Directory adapted: `skills/math-glossary/` (SKILL.md, scripts/, references/, tests/)
- License: MIT (see the upstream repository)
- Adapted commit: recorded in `UPSTREAM.json`
- Changes: SKILL.md trigger text and script invocation guidance adapted for the
  DSH tool surface (`verymath_glossary_*` tools); Python scripts are included
  verbatim. Skill content and scripts remain under the upstream MIT license;
  this NOTICE and UPSTREAM.json record the provenance.

## VeryMath AI4Math-Paper-Reading (`math-paper-reading`)

- Source: https://github.com/VeryMath/AI4Math-Paper-Reading
- Directory adapted: `skills/math-paper-reading/` (agent_router.md, skill_*.md)
- License: MIT (see the upstream repository)
- Adapted commit: recorded in `UPSTREAM.json`
- Changes: routing text adapted for DSH (skill invocation, workspace artifact
  conventions, and the optional `verymath_paper_validate` tool); the analysis
  methodology and output contracts are unchanged and remain under the upstream
  MIT license.

## Remaining code

All other source files in this package are original work, MIT licensed (see
`LICENSE`).
