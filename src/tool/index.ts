/**
 * Model-facing VeryMath tools over `ctx.verymath`: bilingual glossary query
 * and Python-bridged glossary construction, plus paper-structure validation
 * for the adaptive `math-paper-reading` skill artifacts.
 * @module @louisultra/dsh-verymath/tool
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-fs'
import { isAbsolute, resolve } from 'node:path'
import { VeryMathError, isVeryMathError } from '@louisultra/dsh-verymath/core'
import { computeTopology, dependencySummary, focusClosure, mergeBatches, parsePaperStructure, renderMermaid, upsertTerms, type TermUpsert } from '@louisultra/dsh-verymath/core'

export const name = 'tool-verymath'
export const inject = ['tools', 'verymath', 'fs']

/** Config for the tool layer. */
export interface Config {
  /**
   * Default glossary document path used when a call omits `glossaryPath`.
   * Relative paths resolve against the calling agent's workspace cwd.
   */
  readonly glossaryHome?: string
}

export const Config: z<Config> = z.object({
  glossaryHome: z.string(),
})

/** The `verymath_glossary_query` canonical value. */
interface GlossaryQueryJson {
  readonly query: string
  readonly glossary: string
  readonly total: number
  readonly terms: Array<{
    readonly term_id: string
    readonly en: string
    readonly cn: string
    readonly matchedBy: string
    readonly pos?: string
    readonly field?: readonly string[]
    readonly source?: string
    readonly examples?: readonly { readonly en: string; readonly cn: string }[]
  }>
}

/** The `verymath_glossary_build` canonical value. */
interface GlossaryBuildJson {
  readonly script: string
  readonly args: readonly string[]
  readonly exitCode: number
  readonly output: string
  readonly pythonExecutable: string
}

/** The `verymath_python_check` canonical value. */
interface PythonCheckJson {
  readonly available: boolean
  readonly executable?: string
  readonly hint?: string
}

/** The `verymath_paper_validate` canonical value. */
interface PaperValidateJson {
  readonly title: string
  readonly entityCount: number
  readonly mainTheoremCount: number
  readonly sectionCount: number
  readonly roots: readonly string[]
  readonly completeness: string
  readonly valid: true
}

/** Render a glossary query result as a readable bilingual list. */
function renderGlossaryQuery(_args: unknown, value: unknown): ContentBlock[] {
  const result = value as GlossaryQueryJson
  if (result.terms.length === 0) {
    return [{ type: 'text', text: `No glossary terms matched ${JSON.stringify(result.query)}.` }]
  }
  const lines = result.terms.map((term) => {
    const extras = [
      term.pos !== undefined ? `pos: ${term.pos}` : undefined,
      term.field !== undefined && term.field.length > 0 ? `field: ${term.field.join(', ')}` : undefined,
      term.source !== undefined ? `source: ${term.source}` : undefined,
    ].filter((part): part is string => part !== undefined)
    const examples = term.examples !== undefined && term.examples.length > 0
      ? term.examples.slice(0, 2).map(example => `  ex: ${example.en} — ${example.cn}`)
      : []
    return [
      `- ${term.en} | ${term.cn} (${term.matchedBy}${extras.length > 0 ? `; ${extras.join('; ')}` : ''})`,
      ...examples,
    ].join('\n')
  })
  const note = result.total > result.terms.length ? `\n(showing ${result.terms.length} of ${result.total})` : ''
  return [{ type: 'text', text: lines.join('\n') + note }]
}

/** Render a build-script run as its command trace plus captured output. */
function renderGlossaryBuild(_args: unknown, value: unknown): ContentBlock[] {
  const result = value as GlossaryBuildJson
  const parts = [
    `python ${result.script} ${result.args.join(' ')}`,
    `exit code: ${result.exitCode}`,
  ]
  if (result.output.length > 0) parts.push('', result.output)
  return [{ type: 'text', text: parts.join('\n') }]
}

/** Render the Python availability check. */
function renderPythonCheck(_args: unknown, value: unknown): ContentBlock[] {
  const result = value as PythonCheckJson
  return [{
    type: 'text',
    text: result.available
      ? `Python available: ${result.executable}`
      : `Python unavailable. ${result.hint ?? 'Install Python 3 to use the math-glossary scripts.'}`,
  }]
}

/** Render a paper-structure validation as a compact structural digest. */
function renderPaperValidate(_args: unknown, value: unknown): ContentBlock[] {
  const result = value as PaperValidateJson
  return [{
    type: 'text',
    text: [
      `Valid paper structure: ${result.title}`,
      `entities: ${result.entityCount}, main theorems: ${result.mainTheoremCount}, sections: ${result.sectionCount}`,
      `dependency roots: ${result.roots.length > 0 ? result.roots.join(', ') : '(none)'}`,
      `self_containment: ${result.completeness}`,
    ].join('\n'),
  }]
}

/**
 * Resolve a model-supplied path against the calling workspace when relative.
 * @param path - model-supplied path, possibly workspace-relative.
 * @param cwd - the calling agent's session cwd, when known.
 */
function toWorkspacePath(path: string, cwd: string | undefined): string {
  return isAbsolute(path) || cwd === undefined ? path : resolve(cwd, path)
}

/** Map an unknown thrown value onto the tool error taxonomy (route on `code`). */
function toToolError(error: unknown): Error {
  if (isVeryMathError(error)) return error
  if (error instanceof Error) return error
  return new Error(String(error))
}

/** Register the VeryMath glossary and paper tools. */
export const apply = (ctx: Context, config: Config = {}): void => {
  const glossaryHome = config.glossaryHome ?? 'glossary/glossary.json'

  ctx.tools.register(defineTool({
    name: 'verymath_glossary_query',
    description: 'Query a VeryMath bilingual (English-Chinese) mathematical glossary JSON document for terms. Matches by exact English/Chinese term, term id, English prefix, Chinese substring, or subfield name; returns examples when entries carry them (use them to disambiguate polysemous terms per the math-glossary usage guide). Use the field parameter to restrict matches to one subdomain when a term has different translations in different fields. The glossary follows the VeryMath math-glossary contract (sorted entries, unique term_id).',
    parameters: {
      query: { type: 'string', required: true, description: 'English term, Chinese term, term_id, or subfield name' },
      glossaryPath: { type: 'string', description: 'Path of the glossary.json document; defaults to the workspace default glossary' },
      field: { type: 'string', description: 'Restrict matches to terms whose subfield list contains exactly this value, e.g. 代数拓扑' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          query: { type: 'string' },
          glossary: { type: 'string' },
          total: { type: 'number' },
          terms: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                term_id: { type: 'string' },
                en: { type: 'string' },
                cn: { type: 'string' },
                matchedBy: { type: 'string' },
                pos: { type: 'string' },
                field: { type: 'array', items: { type: 'string' } },
                source: { type: 'string' },
                examples: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      en: { type: 'string' },
                      cn: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      render: renderGlossaryQuery,
    },
    async execute(args, exec) {
      try {
        const path = toWorkspacePath(args.glossaryPath ?? glossaryHome, exec.agent?.session.header.cwd)
        const library = await ctx.verymath.loadGlossary(path, exec.signal)
        const { hits, total } = await ctx.verymath.queryGlossaryFile(path, args.query, {
          ...(args.field !== undefined ? { field: args.field } : {}),
          signal: exec.signal,
        })
        return {
          query: args.query,
          glossary: library.path,
          total,
          terms: hits.map(hit => ({
            term_id: hit.term.term_id,
            en: hit.term.en,
            cn: hit.term.cn,
            matchedBy: hit.matchedBy,
            ...(hit.term.pos !== undefined ? { pos: hit.term.pos } : {}),
            ...(hit.term.field !== undefined ? { field: [...hit.term.field] } : {}),
            ...(hit.term.source !== undefined ? { source: hit.term.source } : {}),
            ...(hit.term.examples !== undefined ? { examples: hit.term.examples.map(example => ({ ...example })) } : {}),
          })),
        }
      } catch (error) {
        throw toToolError(error)
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'verymath_glossary_build',
    description: 'Run one VeryMath math-glossary Python script (glossary_build.py, glossary_export.py, glossary_backup.py, glossary_enrich_examples.py) to construct or maintain a bilingual glossary from structured sources (CSV/TSV/JSON/YAML). Requires a local Python 3; use verymath_python_check first to verify availability. OCR, PDF, and free-text sources are handled by the math-glossary skill workflow, not this tool.',
    parameters: {
      script: { type: 'string', required: true, description: 'Script filename, e.g. glossary_build.py' },
      args: { type: 'array', items: { type: 'string' }, description: 'Arguments passed to the script, e.g. ["source.csv", "--output", "glossary/glossary.json", "--no-excel"]' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          script: { type: 'string' },
          args: { type: 'array', items: { type: 'string' } },
          exitCode: { type: 'number' },
          output: { type: 'string' },
          pythonExecutable: { type: 'string' },
        },
      },
      render: renderGlossaryBuild,
    },
    async execute(args) {
      const result = await ctx.verymath.runGlossaryScript(args.script, args.args ?? [])
      const output = [result.stderr.trim(), result.stdout.trim()].filter(part => part.length > 0).join('\n')
      if (result.exitCode !== 0) {
        throw new VeryMathError(
          `glossary script ${args.script} exited ${result.exitCode}: ${output.slice(0, 2000) || '(no output)'}`,
          'VERYMATH_IO',
        )
      }
      // A successful build may have rewritten the glossary on disk; drop stale
      // cached entries so follow-up queries observe the new document.
      const scriptArgs = args.args ?? []
      const outputFlagIndex = scriptArgs.indexOf('--output')
      const outputPath = outputFlagIndex >= 0 ? scriptArgs[outputFlagIndex + 1] : undefined
      if (outputPath !== undefined) ctx.verymath.invalidateGlossary(outputPath)
      else ctx.verymath.invalidateAllGlossaries()
      return {
        script: args.script,
        args: scriptArgs,
        exitCode: result.exitCode,
        output: output.slice(0, 8000),
        pythonExecutable: (await ctx.verymath.resolvePython()) ?? '(unknown)',
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'verymath_glossary_upsert',
    description: 'Add or update terms in a VeryMath bilingual glossary JSON document, preserving the contract invariants automatically: term_id derives from the lowercased English term, the document is re-sorted by (en, cn) with contiguous idx, and updated terms get today\'s date stamps. Use this when reading papers or translating and you encounter a term worth saving — do not hand-edit glossary.json. Existing entries are updated when the term_id matches; unspecified optional fields are preserved.',
    parameters: {
      terms: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            en: { type: 'string', required: true },
            cn: { type: 'string', required: true },
            pos: { type: 'string' },
            field: { type: 'array', items: { type: 'string' } },
            source: { type: 'string' },
            example: {
              type: 'object',
              additionalProperties: false,
              properties: {
                en: { type: 'string' },
                cn: { type: 'string' },
              },
            },
          },
        },
        description: 'Terms to add or update',
      },
      glossaryPath: { type: 'string', description: 'Path of the glossary.json document; defaults to the workspace default glossary. Created with just the new terms when it does not exist yet.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          glossary: { type: 'string' },
          added: { type: 'array', items: { type: 'string' } },
          updated: { type: 'array', items: { type: 'string' } },
          totalTerms: { type: 'number' },
        },
      },
      render: (_args, value) => {
        const result = value as { glossary: string, added: string[], updated: string[], totalTerms: number }
        const parts = [
          `Glossary updated: ${result.glossary}`,
          `added: ${result.added.length > 0 ? result.added.join(', ') : '(none)'}`,
          `updated: ${result.updated.length > 0 ? result.updated.join(', ') : '(none)'}`,
          `total terms: ${result.totalTerms}`,
        ]
        return [{ type: 'text', text: parts.join('\n') }]
      },
    },
    async execute(args, exec) {
      const path = toWorkspacePath(args.glossaryPath ?? glossaryHome, exec.agent?.session.header.cwd)
      const fs = ctx.fs
      if (fs === undefined) {
        throw new VeryMathError('verymath_glossary_upsert requires the fs service', 'VERYMATH_IO')
      }
      const target = await fs.resolve(path, { signal: exec.signal })
      // Read the current document if it exists; an absent file starts a new glossary.
      let current: Awaited<ReturnType<typeof ctx.verymath.loadGlossary>> | undefined
      try {
        current = await ctx.verymath.loadGlossary(path, exec.signal)
      } catch (error) {
        if (!(isVeryMathError(error) && error.code === 'VERYMATH_GLOSSARY_UNAVAILABLE')) throw error
      }
      const requests: TermUpsert[] = (args.terms ?? []).map((request) => {
        const example = request.example
        const validExample = example !== undefined && typeof example.en === 'string' && typeof example.cn === 'string'
          ? { en: example.en, cn: example.cn }
          : undefined
        return {
          en: request.en ?? '',
          cn: request.cn ?? '',
          ...(request.pos !== undefined ? { pos: request.pos } : {}),
          ...(request.field !== undefined ? { field: request.field } : {}),
          ...(request.source !== undefined ? { source: request.source } : {}),
          ...(validExample !== undefined ? { example: validExample } : {}),
        }
      })
      const result = upsertTerms(current?.terms ?? [], requests)
      // Write through ctx.fs so the session sandbox policy governs the write.
      const sandboxPolicy = ctx.get('sandboxPolicy')?.resolve(exec.agent !== undefined ? { session: exec.agent.session } : {})
      await fs.writeText(target, JSON.stringify(result.document, null, 2) + '\n', undefined, exec.signal, sandboxPolicy)
      ctx.verymath.invalidateGlossary(path)
      return {
        glossary: path,
        added: [...result.added],
        updated: [...result.updated],
        totalTerms: result.document.length,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'verymath_python_check',
    description: 'Check whether a Python 3 interpreter is available for the VeryMath math-glossary scripts, and report which executable would be used. Call this before verymath_glossary_build and surface a concrete installation hint when it reports unavailable.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          available: { type: 'boolean' },
          executable: { type: 'string' },
          hint: { type: 'string' },
        },
      },
      render: renderPythonCheck,
    },
    async execute() {
      const python = await ctx.verymath.resolvePython()
      if (python === undefined) {
        return {
          available: false,
          hint: 'Install Python 3 (macOS: xcode-select --install or brew install python3; Windows: python.org installer) and set verymath.pythonExecutable or DSH_OFFICE_PYTHON if it is not on PATH.',
        }
      }
      return { available: true, executable: python }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'verymath_paper_validate',
    description: 'Validate a VeryMath math-paper-reading structure artifact (<slug>_structure.json): checks required metadata, recognized entity kinds, and dependency-label integrity, then returns a compact digest (entity counts, dependency roots, self-containment). Use after generating or editing a structure artifact.',
    parameters: {
      path: { type: 'string', required: true, description: 'Workspace path of the <slug>_structure.json artifact' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          entityCount: { type: 'number' },
          mainTheoremCount: { type: 'number' },
          sectionCount: { type: 'number' },
          roots: { type: 'array', items: { type: 'string' } },
          completeness: { type: 'string' },
          valid: { type: 'boolean' },
        },
      },
      render: renderPaperValidate,
    },
    async execute(args, exec) {
      const absolute = toWorkspacePath(args.path, exec.agent?.session.header.cwd)
      const fs = ctx.fs
      if (fs === undefined) {
        throw new VeryMathError('verymath_paper_validate requires the fs service', 'VERYMATH_IO')
      }
      const raw = await fs.readText(await fs.resolve(absolute, { signal: exec.signal }), exec.signal)
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch (error) {
        throw new VeryMathError(
          `paper structure at ${absolute} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
          'VERYMATH_PAPER_INVALID',
          { cause: error },
        )
      }
      const structure = parsePaperStructure(parsed)
      const { roots } = dependencySummary(structure)
      return {
        title: structure.paper.title,
        entityCount: structure.entities?.length ?? 0,
        mainTheoremCount: structure.main_theorems?.length ?? 0,
        sectionCount: structure.section_map?.length ?? 0,
        roots: [...roots],
        completeness: structure.completeness_check?.self_containment ?? 'unknown',
        valid: true,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'verymath_paper_graph',
    description: 'Compute the dependency graph of a VeryMath math-paper-reading structure artifact (<slug>_structure.json): merges batch files, rebuilds the cited_by reverse index, computes shared_node hubs, in/out degrees, cycle detection, and both reading directions (top-down from main theorems, bottom-up reproduction order). Optionally renders a Mermaid dependency graph (auto-degrades above 40 entities to THEOREM-rooted depth-2 subgraphs unless forceFull). Use this instead of manually counting dependencies — the upstream skill forbids model-side graph traversal.',
    parameters: {
      path: { type: 'string', required: true, description: 'Workspace path of the <slug>_structure.json artifact' },
      extraPaths: { type: 'array', items: { type: 'string' }, description: 'Additional batch artifact paths to merge (upstream batch merging protocol)' },
      render: { type: 'boolean', description: 'Also render the Mermaid graph (default true)' },
      forceFull: { type: 'boolean', description: 'Force full Mermaid rendering even above the 40-entity degradation threshold' },
      focus: { type: 'string', description: 'Return the transitive dependency closure and layered reading path for this entity label (e.g. a main theorem), instead of (or in addition to) the full-graph digest' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          totalEntities: { type: 'number' },
          mergedDuplicates: { type: 'number' },
          danglingEdges: { type: 'array', items: { type: 'string' } },
          sharedNodes: { type: 'array', items: { type: 'string' } },
          cycles: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
          isolated: { type: 'array', items: { type: 'string' } },
          longestChain: { type: 'array', items: { type: 'string' } },
          topDownOrder: { type: 'array', items: { type: 'string' } },
          bottomUpLevels: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
          degradedRendering: { type: 'boolean' },
          metrics: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                label: { type: 'string' },
                type: { type: 'string' },
                inDegree: { type: 'number' },
                outDegree: { type: 'number' },
                sharedNode: { type: 'boolean' },
                supportsMainTheorem: { type: 'boolean' },
              },
            },
          },
          mermaid: { type: 'string' },
          focus: {
            type: 'object',
            additionalProperties: false,
            properties: {
              label: { type: 'string' },
              found: { type: 'boolean' },
              closure: { type: 'array', items: { type: 'string' } },
              levels: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
            },
          },
        },
      },
      render: (_args, value) => {
        const result = value as {
          title: string, totalEntities: number, sharedNodes: string[], cycles: string[][],
          isolated: string[], longestChain: string[], bottomUpLevels: string[][],
          degradedRendering: boolean, metrics: Array<{ label: string, type: string, inDegree: number, outDegree: number, sharedNode: boolean }>, mermaid?: string,
          focus?: { label: string, found: boolean, closure: string[], levels: string[][] },
        }
        const parts = [
          `Dependency graph for ${result.title}: ${result.totalEntities} entities`,
          `shared nodes (hubs): ${result.sharedNodes.length > 0 ? result.sharedNodes.join(', ') : '(none)'}`,
          `cycles: ${result.cycles.length > 0 ? result.cycles.map(cycle => cycle.join(' -> ')).join('; ') : 'none'}`,
          `isolated: ${result.isolated.length > 0 ? result.isolated.join(', ') : '(none)'}`,
          `longest chain: ${result.longestChain.join(' -> ')}`,
          `bottom-up levels: ${result.bottomUpLevels.map(level => `[${level.join(', ')}]`).join(' -> ')}`,
        ]
        if (result.degradedRendering) parts.push('(rendering degraded: >40 entities)')
        const top = result.metrics
          .filter(metric => metric.sharedNode || metric.inDegree >= 3)
          .map(metric => `- ${metric.label} (${metric.type}): in ${metric.inDegree}, out ${metric.outDegree}${metric.sharedNode ? ' [shared]' : ''}`)
        if (top.length > 0) parts.push('key nodes:', ...top)
        if (result.focus !== undefined) {
          if (!result.focus.found) {
            parts.push(`focus ${JSON.stringify(result.focus.label)}: not found in the merged entities`)
          } else {
            parts.push(
              `reading path for ${result.focus.label} (bottom-up layers):`,
              ...result.focus.levels.map((level, index) => `  L${index}: ${level.join(', ')}`),
            )
          }
        }
        if (result.mermaid !== undefined) parts.push('', '```mermaid', result.mermaid, '```')
        return [{ type: 'text', text: parts.join('\n') }]
      },
    },
    async execute(args, exec) {
      const paths = [args.path, ...(args.extraPaths ?? [])]
      const fs = ctx.fs
      if (fs === undefined) {
        throw new VeryMathError('verymath_paper_graph requires the fs service', 'VERYMATH_IO')
      }
      const cwd = exec.agent?.session.header.cwd
      const documents = await Promise.all(paths.map(async (path) => {
        const absolute = toWorkspacePath(path, cwd)
        const raw = await fs.readText(await fs.resolve(absolute, { signal: exec.signal }), exec.signal)
        let parsed: unknown
        try {
          parsed = JSON.parse(raw)
        } catch (error) {
          throw new VeryMathError(
            `paper structure at ${absolute} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
            'VERYMATH_PAPER_INVALID',
            { cause: error },
          )
        }
        return parsePaperStructure(parsed)
      }))
      const primary = documents[0]
      if (primary === undefined) {
        throw new VeryMathError('no structure artifact paths resolved', 'VERYMATH_PAPER_INVALID')
      }
      const input: typeof primary | typeof documents = documents.length === 1 ? primary : documents
      const { report } = mergeBatches(input)
      const topology = computeTopology(input)
      const focus = args.focus !== undefined ? focusClosure(input, args.focus) : undefined
      const shouldRender = args.render ?? true
      const mermaid = shouldRender && primary !== undefined
        ? renderMermaid(primary, { ...(args.forceFull === true ? { forceFull: true } : {}) })
        : undefined
      return {
        title: primary.paper.title,
        totalEntities: report.totalEntities,
        mergedDuplicates: report.mergedDuplicates,
        danglingEdges: [...report.danglingEdges],
        sharedNodes: [...report.sharedNodes],
        cycles: topology.cycles.map(cycle => [...cycle.labels]),
        isolated: [...topology.isolated],
        longestChain: [...topology.longestChain],
        topDownOrder: [...topology.topDownOrder],
        bottomUpLevels: topology.bottomUpLevels.map(level => [...level]),
        degradedRendering: topology.degradedRendering,
        metrics: topology.metrics.map(metric => ({
          label: metric.label,
          type: metric.type,
          inDegree: metric.inDegree,
          outDegree: metric.outDegree,
          sharedNode: metric.sharedNode,
          supportsMainTheorem: metric.supportsMainTheorem,
        })),
        ...(mermaid !== undefined ? { mermaid } : {}),
        ...(focus !== undefined
          ? {
              focus: {
                label: focus.label,
                found: focus.found,
                closure: [...focus.closure],
                levels: focus.levels.map(level => [...level]),
              },
            }
          : {}),
      }
    },
  }))
}
