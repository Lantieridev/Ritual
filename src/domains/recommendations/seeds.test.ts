import { describe, it, expect } from 'vitest'
import { pickSeeds, SEED_ARTISTS, SEED_MIN } from './seeds'

describe('pickSeeds — tier 1: declared genres ∩ artist_genres', () => {
  it('wins when at least SEED_MIN genre-matched artists are ranked, keeping the given order', () => {
    const result = pickSeeds({
      genreRanked: ['Bandalos Chinos', 'El Mató', 'Usted Señálemelo'],
      countryRanked: ['Divididos', 'Babasónicos', 'Wos'],
      hasDeclaredGenres: true,
    })

    expect(result).toEqual({
      names: ['Bandalos Chinos', 'El Mató', 'Usted Señálemelo'],
      note: 'De los géneros que elegiste',
    })
  })

  it('caps at 6 names even with more genre-matched candidates', () => {
    const result = pickSeeds({
      genreRanked: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'],
      countryRanked: [],
      hasDeclaredGenres: true,
    })

    expect(result.names).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6'])
  })
})

describe('pickSeeds — tier 2: importance-ranked fallback', () => {
  it('wins with the suffix when the user declared no genres at all (JD-002)', () => {
    const result = pickSeeds({
      genreRanked: [],
      countryRanked: ['Divididos', 'Babasónicos', 'Wos'],
      hasDeclaredGenres: false,
    })

    expect(result).toEqual({
      names: ['Divididos', 'Babasónicos', 'Wos'],
      note: 'Los más escuchados y cargados del país · completá el registro para afinarlo',
    })
  })

  it('wins WITHOUT the suffix when the user declared genres but fewer than SEED_MIN matched (JD-002 negative case)', () => {
    const result = pickSeeds({
      genreRanked: ['Bandalos Chinos'],
      countryRanked: ['Divididos', 'Babasónicos', 'Wos'],
      hasDeclaredGenres: true,
    })

    expect(result).toEqual({
      names: ['Divididos', 'Babasónicos', 'Wos'],
      note: 'Los más escuchados y cargados del país',
    })
  })
})

describe('pickSeeds — tier 3: hardcoded fallback', () => {
  it('falls back to SEED_ARTISTS with "Para arrancar" when neither tier has enough data', () => {
    const result = pickSeeds({ genreRanked: [], countryRanked: [], hasDeclaredGenres: false })

    expect(result).toEqual({ names: SEED_ARTISTS.slice(0, 6), note: 'Para arrancar' })
  })

  it('also falls back when both tiers have fewer than SEED_MIN candidates', () => {
    const result = pickSeeds({ genreRanked: ['solo-uno'], countryRanked: ['solo-dos', 'y-dos'], hasDeclaredGenres: true })

    expect(result.note).toBe('Para arrancar')
    expect(result.names).toEqual(SEED_ARTISTS.slice(0, 6))
  })
})

describe('SEED_MIN', () => {
  it('is 3, the threshold every tier check above relies on', () => {
    expect(SEED_MIN).toBe(3)
  })
})
