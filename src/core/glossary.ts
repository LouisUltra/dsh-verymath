/**
 * Bilingual glossary data model aligned with the upstream VeryMath
 * `math-glossary` contract (glossary.schema.json v1): an array of term
 * entries sorted by (en, cn) with contiguous 1-based `idx` numbering,
 * plus the cross-entry invariants the upstream contract requires.
 * @module @louisultra/dsh-verymath/core
 */
import { VeryMathError } from './error.ts'

/** One bilingual term entry (upstream `math-glossary` contract). */
export interface GlossaryTerm {
  /** Unique id: lowercased `en`, with an `__N` suffix on alias rows. */
  readonly term_id: string
  /** English term as written in the source. */
  readonly en: string
  /** Chinese translation; on alias rows this is the alias. */
  readonly cn: string
  /** Optional 1-based contiguous position after sorting. */
  readonly idx?: number
  /** Optional part of speech in Chinese (名词 / 动词 / …). */
  readonly pos?: string
  /** Optional subfields, multi-value (代数拓扑, 拓扑学…). */
  readonly field?: readonly string[]
  /** Optional source reference label. */
  readonly source?: string
  /** Optional bilingual example sentences. */
  readonly examples?: readonly { readonly en: string; readonly cn: string }[]
  /** ISO date (YYYY-MM-DD). */
  readonly created_at: string
  /** ISO date (YYYY-MM-DD). */
  readonly updated_at: string
}

/** Parse a loose value into a glossary term entry, or return a problem description. */
function coerceTerm(value: unknown): { term: GlossaryTerm } | { problem: string } {
  if (typeof value !== 'object' || value === null) return { problem: `entry is ${describe(value)}, expected an object` }
  const record = value as Record<string, unknown>
  const problems: string[] = []
  for (const field of ['term_id', 'en', 'cn', 'created_at', 'updated_at'] as const) {
    if (typeof record[field] !== 'string' || (record[field] as string).length === 0) {
      problems.push(`${field} must be a non-empty string`)
    }
  }
  if (problems.length > 0) return { problem: problems.join('; ') }
  // Build the complete entry in one pass: GlossaryTerm fields are readonly,
  // so optional fields are included up front instead of assigned afterwards.
  const fields = Array.isArray(record.field)
    ? record.field.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    : []
  const examples = Array.isArray(record.examples)
    ? record.examples.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null) return []
        const example = entry as Record<string, unknown>
        if (typeof example.en !== 'string' || typeof example.cn !== 'string') return []
        return [{ en: example.en, cn: example.cn }]
      })
    : []
  const term: GlossaryTerm = {
    term_id: record.term_id as string,
    en: record.en as string,
    cn: record.cn as string,
    ...(typeof record.idx === 'number' ? { idx: record.idx } : {}),
    ...(typeof record.pos === 'string' && record.pos.length > 0 ? { pos: record.pos } : {}),
    ...(typeof record.source === 'string' && record.source.length > 0 ? { source: record.source } : {}),
    ...(fields.length > 0 ? { field: fields } : {}),
    ...(examples.length > 0 ? { examples } : {}),
    created_at: record.created_at as string,
    updated_at: record.updated_at as string,
  }
  return { term }
}

function describe(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  return typeof value
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Whether a value parses as a complete validated glossary document. */
export function parseGlossary(value: unknown): GlossaryTerm[] {
  if (!Array.isArray(value)) {
    throw new VeryMathError(`glossary document must be an array, got ${describe(value)}`, 'VERYMATH_GLOSSARY_INVALID')
  }
  const terms: GlossaryTerm[] = []
  for (const [index, entry] of value.entries()) {
    const result = coerceTerm(entry)
    if ('problem' in result) {
      throw new VeryMathError(`glossary entry ${index}: ${result.problem}`, 'VERYMATH_GLOSSARY_INVALID')
    }
    terms.push(result.term)
  }
  return terms
}

/**
 * Sort terms by (en, cn) using stable code-point order and reassign
 * contiguous 1-based `idx` values, the upstream write-path invariant.
 * @param terms - terms in any order; the input is not mutated.
 * @returns a new sorted array with `idx` reassigned.
 */
export function sortGlossary(terms: readonly GlossaryTerm[]): GlossaryTerm[] {
  const sorted = [...terms].sort((left, right) =>
    compareCodePoints(left.en, right.en) || compareCodePoints(left.cn, right.cn),
  )
  return sorted.map((term, index) => ({ ...term, idx: index + 1 }))
}

function compareCodePoints(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

/** Validate the cross-entry invariants of a stored glossary document. */
export function validateGlossaryInvariants(terms: readonly GlossaryTerm[]): void {
  const seen = new Map<string, number>()
  for (const term of terms) {
    seen.set(term.term_id, (seen.get(term.term_id) ?? 0) + 1)
    for (const field of ['created_at', 'updated_at'] as const) {
      if (!ISO_DATE.test(term[field])) {
        throw new VeryMathError(`term ${term.term_id}: ${field} must be YYYY-MM-DD`, 'VERYMATH_GLOSSARY_INVALID')
      }
    }
  }
  const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([id]) => id)
  if (duplicates.length > 0) {
    throw new VeryMathError(`duplicate term_id values: ${duplicates.join(', ')}`, 'VERYMATH_GLOSSARY_INVALID')
  }
  const ids = terms.map(term => term.idx).filter(index => index !== undefined)
  if (ids.length > 0) {
    const expected = terms.map((_, index) => index + 1)
    const actual = ids
    const contiguous = actual.length === terms.length && actual.every((value, index) => value === expected[index])
    if (!contiguous) {
      throw new VeryMathError('idx numbering must be contiguous 1-based over the sorted document', 'VERYMATH_GLOSSARY_INVALID')
    }
  }
}

/** One glossary query hit. */
export interface GlossaryHit {
  readonly term: GlossaryTerm
  /** Which field matched: en (exact), en-prefix, cn, field, or term_id. */
  readonly matchedBy: 'en' | 'en-prefix' | 'cn' | 'field' | 'term_id'
}

/**
 * Query a parsed glossary: exact en/cn match first, then prefix and field hits.
 * @param terms - validated glossary terms.
 * @param query - user query: an English/Chinese term, a term_id, or a subfield name.
 * @param limit - maximum hits returned (default 20).
 */
export function queryGlossary(terms: readonly GlossaryTerm[], query: string, limit = 20): GlossaryHit[] {
  const needle = query.trim()
  if (needle.length === 0) return []
  const lower = needle.toLowerCase()
  const hits: GlossaryHit[] = []
  const push = (term: GlossaryTerm, matchedBy: GlossaryHit['matchedBy']) => {
    if (hits.length < limit && !hits.some(hit => hit.term.term_id === term.term_id)) {
      hits.push({ term, matchedBy })
    }
  }
  for (const term of terms) {
    if (term.en.toLowerCase() === lower || term.cn === needle) push(term, 'en')
    else if (term.term_id.toLowerCase() === lower) push(term, 'term_id')
  }
  if (hits.length >= limit) return hits
  for (const term of terms) {
    if (term.en.toLowerCase().startsWith(lower)) push(term, 'en-prefix')
  }
  if (hits.length >= limit) return hits
  for (const term of terms) {
    if (term.cn.includes(needle)) push(term, 'cn')
  }
  if (hits.length >= limit) return hits
  for (const term of terms) {
    if (term.field?.some(entry => entry === needle || entry.includes(needle))) push(term, 'field')
  }
  return hits
}
