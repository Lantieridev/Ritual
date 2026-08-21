import { describe, it, expect } from 'vitest'
import { classifyGenreTag, normalizeGenre } from '@/src/domains/taste/normalizeGenre'

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

describe('classifyGenreTag', () => {
  const aliases = new Map<string, string | null>([
    ['rock nac', 'rock-nacional'],
    ['live', null],
    ['shoegaze', 'shoegaze'],
  ])
  const keys = new Set(['rock-nacional', 'indie'])

  it('classifies a known alias as its canonical genre', () => {
    expect(classifyGenreTag('Rock Nac.', aliases, keys)).toEqual({ kind: 'genre', key: 'rock-nacional' })
  })

  it('classifies a curated noise alias as noise, so it is not reported for curation', () => {
    expect(classifyGenreTag('Seen: LIVE', new Map([['seen live', null]]), keys)).toEqual({ kind: 'noise' })
    expect(classifyGenreTag('Live', aliases, keys)).toEqual({ kind: 'noise' })
  })

  it('classifies a tag with no alias row as unmapped', () => {
    expect(classifyGenreTag('some random tag nobody curated', aliases, keys)).toEqual({ kind: 'unmapped' })
  })

  it('classifies an alias pointing to a genre missing from the vocabulary as unmapped', () => {
    expect(classifyGenreTag('Shoegaze', aliases, keys)).toEqual({ kind: 'unmapped' })
  })
})
