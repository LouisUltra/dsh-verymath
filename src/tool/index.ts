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
import { dependencySummary, parsePaperStructure } from '@louisultra/dsh-verymath/core'

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
    return `- ${term.en} | ${term.cn} (${term.matchedBy}${extras.length > 0 ? `; ${extras.join('; ')}` : ''})`
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
    description: 'Query a VeryMath bilingual (English-Chinese) mathematical glossary JSON document for terms. Matches by exact English/Chinese term, term id, English prefix, Chinese substring, or subfield name. The glossary follows the VeryMath math-glossary contract (sorted entries, unique term_id).',
    parameters: {
      query: { type: 'string', required: true, description: 'English term, Chinese term, term_id, or subfield name' },
      glossaryPath: { type: 'string', description: 'Path of the glossary.json document; defaults to the workspace default glossary' },
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
        const hits = await ctx.verymath.queryGlossaryFile(path, args.query, exec.signal)
        return {
          query: args.query,
          glossary: library.path,
          total: hits.length,
          terms: hits.map(hit => ({
            term_id: hit.term.term_id,
            en: hit.term.en,
            cn: hit.term.cn,
            matchedBy: hit.matchedBy,
            ...(hit.term.pos !== undefined ? { pos: hit.term.pos } : {}),
            ...(hit.term.field !== undefined ? { field: [...hit.term.field] } : {}),
            ...(hit.term.source !== undefined ? { source: hit.term.source } : {}),
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
      return {
        script: args.script,
        args: args.args ?? [],
        exitCode: result.exitCode,
        output: output.slice(0, 8000),
        pythonExecutable: (await ctx.verymath.resolvePython()) ?? '(unknown)',
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
}
