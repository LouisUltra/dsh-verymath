# Glossary coverage gap self-audit

Compared upstream `AI4Math-MathTool/skills/math-glossary/tests/test_glossary_tools.py` (19 tests, 607 lines)
against our plugin's TS tests (146 specs) and bundled scripts.

## Verified working right now (real execution)
- All 5 bundled scripts pass `--help` (glossary_backup/export/build/enrich_examples/web).
- Real backup round-trip: `glossary_backup.py` writes timestamped backup, original untouched. rc=0.
- Real Excel export: `glossary_export.py export glossary.json outdir/` produced valid xlsx via openpyxl. rc=0.

## Upstream-tested behaviors we have NOT covered
1. **export → import round-trip with unique alias ids** (upstream test line 304): our upsertTerms handles
   term_id derivation but we never test the export script's alias-id uniqueness.
2. **export rejects invalid schema before writing** (upstream 352): our validateGlossaryInvariants covers
   JSON-level invariants, but the Excel export path's own validation is untested by us.
3. **Excel formula neutralization** (upstream 361): cells starting with `=`,`+`,`-` must be neutralized to
   prevent formula injection on reimport. Our pipeline never tests this.
4. **backup preserves bytes, never overwrites** (upstream 73): we smoke-tested manually; no automated test.
5. **web CLI loopback-only default + rejects implicit remote binding** (upstream 541): security-relevant,
   untested by us (web UI is a skill-workflow path).
6. **enrich_examples without openai dependency / explicit model+key required** (upstream 411/467): untested.
7. **change-log canonicalization server-side** (upstream 253): web path, untested.

## Action items (feed into Phase 4)
- A1: Port upstream Python tests to run against our bundled scripts as a `test:upstream` script (they load
  scripts by path — can point at our copies directly). **Partially done, and the label was wrong until
  2026-11-10**: `npm run test:upstream` runs the 19 upstream tests, but it points at the *research clone*
  (`../../research/AI4Math-MathTool/skills/math-glossary/tests`), and those tests locate `scripts/` relative
  to their own file, so they exercise the clone's scripts, not the copies inside this package. That is a
  useful regression gate for upstream behaviour, but it is **not** a test of the bundled scripts. Closing it
  properly means copying the test module next to `skills/math-glossary/scripts` (or passing the script root
  explicitly) and running it from the packed artifact.
- A2: Add TS-side tests for upsert alias rows (`en__N`) matching upstream unique-alias-id semantics.
  **Done in 0.3.4** — and it turned out to be a real defect, not just a coverage gap: `upsertTerms` never
  created alias rows and overwrote the primary translation when a second one was stored. Now covered by
  alias-creation, correction-by-`term_id`, gap/skip allocation, ambiguity, and unknown/blank-id rejection
  tests.
- A3: Document that web UI + enrich are skill-workflow paths with their own upstream test coverage; decide
  whether to wire them into `npm run check` (network/dependency gated). **Documented, not wired** (they need
  network/Flask/openpyxl).
