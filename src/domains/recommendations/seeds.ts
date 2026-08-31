/**
 * The first-time hero's seed ladder (issue #81's third capability). Pure —
 * it only decides which already-ranked list wins and what note goes with
 * it; the DB reads and the peso × proximity ranking for tier 1 live in
 * `service.ts` (`getFirstTimeSeeds`), same split as `rank.ts`/`reasons.ts`
 * do for the main strip.
 */

/** A tier needs at least this many candidates to win over the next one down. */
export const SEED_MIN = 3
const SEED_MAX = 6

/** Last resort when neither declared genres nor importance data produced enough candidates — same list the mock ships with. */
export const SEED_ARTISTS = ['Divididos', 'Babasónicos', 'Wos', 'Trueno', 'Dillom', 'Las Pelotas']

export interface SeedSet {
  names: string[]
  note: string
}

export interface PickSeedsInput {
  /** Names of declared-genre-matched artists, already ranked by peso × proximity (service.ts). */
  genreRanked: readonly string[]
  /** Names of the top artists by peso nationwide, already ranked (service.ts). */
  countryRanked: readonly string[]
  hasDeclaredGenres: boolean
}

/**
 * Tier 1 (declared genres) wins with at least `SEED_MIN` matches; else tier 2
 * (importance) wins with at least `SEED_MIN` candidates — its note carries
 * the "completá el registro" suffix ONLY when the user declared no genres at
 * all (JD-002, not merely "too few matches"); else the hardcoded fallback.
 */
export function pickSeeds(input: PickSeedsInput): SeedSet {
  if (input.genreRanked.length >= SEED_MIN) {
    return { names: input.genreRanked.slice(0, SEED_MAX), note: 'De los géneros que elegiste' }
  }

  if (input.countryRanked.length >= SEED_MIN) {
    const suffix = input.hasDeclaredGenres ? '' : ' · completá el registro para afinarlo'
    return { names: input.countryRanked.slice(0, SEED_MAX), note: `Los más escuchados y cargados del país${suffix}` }
  }

  return { names: SEED_ARTISTS.slice(0, SEED_MAX), note: 'Para arrancar' }
}
