import { describe, expect, it } from 'vitest'
import {
  parseGlossary,
  queryGlossary,
  sortGlossary,
  validateGlossaryInvariants,
  type GlossaryTerm,
} from '../../src/core/index.ts'
import { VeryMathError } from '../../src/core/index.ts'

const today = '2026-10-14'

function term(overrides: Partial<GlossaryTerm> = {}): GlossaryTerm {
  return {
    term_id: 'manifold',
    en: 'manifold',
    cn: '流形',
    created_at: today,
    updated_at: today,
    ...overrides,
  }
}

describe('parseGlossary', () => {
  it('accepts a valid document with optional fields', () => {
    const terms = parseGlossary([
      term({ idx: 1, pos: '名词', field: ['拓扑学'], source: '新英汉数学词汇', examples: [{ en: 'a smooth manifold', cn: '光滑流形' }] }),
      { term_id: 'group', en: 'group', cn: '群', created_at: today, updated_at: today },
    ])
    expect(terms).toHaveLength(2)
    expect(terms[0]?.field).toEqual(['拓扑学'])
    expect(terms[1]?.pos).toBeUndefined()
  })

  it('rejects a non-array document', () => {
    expect(() => parseGlossary({})).toThrow(VeryMathError)
    try {
      parseGlossary('nope')
      expect.unreachable()
    } catch (error) {
      expect((error as VeryMathError).code).toBe('VERYMATH_GLOSSARY_INVALID')
    }
  })

  it('rejects entries missing required fields with the entry index', () => {
    try {
      parseGlossary([{ en: 'group', cn: '群' }])
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(VeryMathError)
      expect((error as VeryMathError).message).toContain('glossary entry 0')
      expect((error as VeryMathError).message).toContain('term_id')
    }
  })

  it('drops malformed optional fields silently (compact upstream form)', () => {
    const terms = parseGlossary([
      term({ field: 'not-an-array' as unknown as string[], examples: [{ en: 'x' }] }),
    ])
    expect(terms[0]?.field).toBeUndefined()
    expect(terms[0]?.examples).toBeUndefined()
  })
})

describe('sortGlossary', () => {
  it('sorts by en then cn and reassigns contiguous idx', () => {
    const sorted = sortGlossary([
      term({ term_id: 'zebra', en: 'zebra', cn: '斑马' }),
      term({ term_id: 'group', en: 'group', cn: '群' }),
      term({ term_id: 'group__1', en: 'group', cn: '群' }),
      term({ term_id: 'axiom-of-choice', en: 'axiom of choice', cn: '选择公理' }),
    ])
    expect(sorted.map(entry => entry.en)).toEqual(['axiom of choice', 'group', 'group', 'zebra'])
    expect(sorted.map(entry => entry.idx)).toEqual([1, 2, 3, 4])
  })

  it('does not mutate the input', () => {
    const input = [term({ term_id: 'zebra', en: 'zebra', cn: '斑马' })]
    const snapshot = [...input]
    sortGlossary(input)
    expect(input).toEqual(snapshot)
  })
})

describe('validateGlossaryInvariants', () => {
  it('accepts unique ids and ISO dates', () => {
    expect(() => validateGlossaryInvariants([term(), term({ term_id: 'group', en: 'group', cn: '群' })])).not.toThrow()
  })

  it('rejects duplicate term_id values', () => {
    expect(() => validateGlossaryInvariants([term(), term()])).toThrow(/duplicate term_id/)
  })

  it('rejects non-ISO dates', () => {
    expect(() => validateGlossaryInvariants([term({ created_at: '2026/10/14' })])).toThrow(/YYYY-MM-DD/)
  })

  it('rejects non-contiguous idx numbering', () => {
    expect(() => validateGlossaryInvariants([term({ idx: 1 }), term({ term_id: 'group', en: 'group', cn: '群', idx: 3 })]))
      .toThrow(/contiguous/)
  })
})

describe('queryGlossary', () => {
  const glossary = sortGlossary([
    term(),
    term({ term_id: 'smooth-manifold', en: 'smooth manifold', cn: '光滑流形', field: ['微分几何'] }),
    term({ term_id: 'group', en: 'group', cn: '群' }),
    term({ term_id: 'cohomology', en: 'cohomology', cn: '上同调', field: ['代数拓扑', '微分几何'] }),
  ])

  it('matches exact English terms first', () => {
    const hits = queryGlossary(glossary, 'manifold')
    expect(hits[0]?.matchedBy).toBe('en')
    expect(hits[0]?.term.cn).toBe('流形')
  })

  it('matches exact Chinese terms', () => {
    const hits = queryGlossary(glossary, '群')
    expect(hits[0]?.term.term_id).toBe('group')
  })

  it('falls back to English prefix', () => {
    const hits = queryGlossary(glossary, 'coh')
    expect(hits.map(hit => hit.term.term_id)).toEqual(['cohomology'])
    expect(hits[0]?.matchedBy).toBe('en-prefix')
  })

  it('falls back to Chinese substring', () => {
    const hits = queryGlossary(glossary, '流形')
    // Both entries contain 流形; hits follow document (en,cn) order.
    expect(hits.map(hit => hit.term.term_id)).toEqual(['manifold', 'smooth-manifold'])
  })

  it('matches by subfield name', () => {
    const hits = queryGlossary(glossary, '代数拓扑')
    expect(hits[0]?.matchedBy).toBe('field')
    expect(hits[0]?.term.term_id).toBe('cohomology')
  })

  it('returns empty for empty queries and dedupes hits', () => {
    expect(queryGlossary(glossary, '  ')).toEqual([])
    const hits = queryGlossary(glossary, 'manifold', 1)
    expect(hits).toHaveLength(1)
  })
})
