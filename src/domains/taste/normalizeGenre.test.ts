import { describe, it, expect } from 'vitest'
import { normalizeGenre } from '@/src/domains/taste/normalizeGenre'

describe('normalizeGenre', () => {
  const aliases = new Map<string, string | null>([
    ['rock nac', 'rock-nacional'],
    ['live', null],
  ])
  const keys = new Set(['rock-nacional', 'indie'])

  it('normalizes a known alias to its canonical genre key', () => {
    expect(normalizeGenre('Rock Nac.', aliases, keys)).toBe('rock-nacional')
  })

  it('returns null for a tag with no alias row at all', () => {
    expect(normalizeGenre('some random tag nobody curated', aliases, keys)).toBeNull()
  })

  it('returns null for a known noise alias mapped to no genre', () => {
    expect(normalizeGenre('Live', aliases, keys)).toBeNull()
  })
})
