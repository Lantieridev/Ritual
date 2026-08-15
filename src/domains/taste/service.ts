import { listGenres as listGenresData } from './data'
import type { GenreOption } from './data'

export type { GenreOption }

/**
 * Use-case layer for the taste domain (ADR 0001) — same seam as
 * `src/domains/artists/service.ts` (issue #25): the GraphQL resolver and any
 * Server Component call through here instead of importing `./data` directly.
 */

/** Canonical genre vocabulary, sorted for display — used by signup and the profile picker. */
export async function listGenres(): Promise<GenreOption[]> {
  return listGenresData()
}
