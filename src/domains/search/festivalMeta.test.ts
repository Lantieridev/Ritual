import { describe, it, expect } from 'vitest'
import { festivalMetaLine } from '@/src/domains/search/festivalMeta'

describe('festivalMetaLine', () => {
  it('prefers the edition when it is set', () => {
    expect(festivalMetaLine('2026', 'Córdoba')).toBe('Festival · 2026')
  })

  it('falls back to the city when there is no edition', () => {
    expect(festivalMetaLine(null, 'Córdoba')).toBe('Festival · Córdoba')
  })

  it('returns null when neither edition nor city is set — never invents a value', () => {
    expect(festivalMetaLine(null, null)).toBeNull()
  })
})
