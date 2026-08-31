import { createClient } from '@/src/core/lib/supabase/server'
import type { ActionResult } from '@/src/core/types'
import { MAX_GENRES, MIN_AGE_YEARS, MAX_AGE_YEARS } from './parseSignupTaste'
import { importLastfmForUser } from './importLastfmForUser'
import { syncCityCoordinates as syncCityCoordinatesData } from './syncCityCoordinates'
import {
  listGenres as listGenresData,
  getTasteProfileRow,
  writeTasteProfile,
  setLastfmUsername,
  removeLastfmConnection,
  getTasteProfile as getTasteProfileData,
  getArtistImportance as getArtistImportanceData,
  getArtistGenres as getArtistGenresData,
  findRankingContext as findRankingContextData,
  findArtistsByGenres as findArtistsByGenresData,
  findTopImportanceArtists as findTopImportanceArtistsData,
} from './data'
import type { GenreOption, TasteProfileRow, RankingContext, SeedArtistCandidate } from './data'
import type { ArtistImportance, TasteBasis, TasteProfile, TasteSourceId } from './types'

export type {
  GenreOption,
  TasteProfileRow,
  RankingContext,
  SeedArtistCandidate,
  ArtistImportance,
  TasteBasis,
  TasteProfile,
  TasteSourceId,
}

/**
 * Use-case layer for the taste domain (ADR 0001) — same seam as
 * `src/domains/artists/service.ts` (issue #25): the GraphQL resolver and any
 * Server Component call through here instead of importing `./data` directly.
 *
 * Auth pattern matches `src/domains/auth/service.ts`: every mutation derives
 * the acting user from its own `supabase.auth.getUser()` call instead of
 * trusting a caller-supplied id, so a taste mutation can only ever act on the
 * signed-in user.
 */

/** Canonical genre vocabulary, sorted for display — used by signup and the profile picker. */
export async function listGenres(): Promise<GenreOption[]> {
  return listGenresData()
}

/** Current user's editable taste fields, for the profile edit page's defaults. Mirrors `findProfile(userId)`. */
export async function findTasteProfile(userId: string): Promise<TasteProfileRow | null> {
  return getTasteProfileRow(userId)
}

export interface TasteProfileUpdateInput {
  genres: string[]
  birthYear: number | null
}

/** Edits genres and birth year (spec "Profile taste fields are editable") — always a full replace, never a partial update. */
export async function updateTasteProfile(input: TasteProfileUpdateInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No estás autenticado.' }

  if (input.genres.length > MAX_GENRES) {
    return { error: 'Elegí como máximo 5 géneros.' }
  }

  if (input.birthYear != null) {
    const currentYear = new Date().getFullYear()
    if (input.birthYear < currentYear - MAX_AGE_YEARS || input.birthYear > currentYear - MIN_AGE_YEARS) {
      return { error: 'Revisá el año de nacimiento.' }
    }
  }

  const validKeys = new Set((await listGenresData()).map((genre) => genre.key))
  const genres = [...new Set(input.genres)].filter((key) => validKeys.has(key))

  return writeTasteProfile(supabase, user.id, { genres, birthYear: input.birthYear })
}

const LASTFM_USERNAME_PATTERN = /^[A-Za-z][\w-]{1,14}$/

/**
 * Connects a Last.fm username: runs the shared import first, and only saves
 * the username if Last.fm actually recognizes it (spec "Unknown username is
 * not saved"). A missing API key makes the import no-op without an error, so
 * the username is still saved — see `importLastfmForUser`.
 */
export async function connectLastfm(username: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No estás autenticado.' }

  const trimmed = username.trim()
  if (!LASTFM_USERNAME_PATTERN.test(trimmed)) {
    return { error: 'Nombre de usuario de Last.fm inválido.' }
  }

  const result = await importLastfmForUser(supabase, user.id, trimmed)
  if (result.notFound) {
    return { error: 'No encontramos ese usuario en Last.fm.' }
  }

  return setLastfmUsername(supabase, user.id, trimmed, new Date().toISOString())
}

/** Disconnects Last.fm: deletes the imports, then nulls the username (spec "Disconnect purges data"). */
export async function disconnectLastfm(): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No estás autenticado.' }

  return removeLastfmConnection(supabase, user.id)
}

/**
 * The blended taste read model (issue #81 — `recommendations` needs it for
 * the affinity factor, and ADR 0001 says it can only reach it through this
 * seam, never `./data` directly).
 */
export async function getTasteProfile(userId: string, now?: Date): Promise<TasteProfile> {
  return getTasteProfileData(userId, now)
}

/** Batched `artist_importance` read, for the peso/importance factor. */
export async function getArtistImportance(artistIds: readonly string[]): Promise<Map<string, ArtistImportance>> {
  return getArtistImportanceData(artistIds)
}

/** Batched `artist_genres` read, for the declared-genre affinity/reason match. */
export async function getArtistGenres(artistIds: readonly string[]): Promise<Map<string, readonly string[]>> {
  return getArtistGenresData(artistIds)
}

/** Declared genres + city coordinates for the ranking pure core (proximity + declared-genres basis). */
export async function findRankingContext(userId: string): Promise<RankingContext | null> {
  return findRankingContextData(userId)
}

/** Tier 1 of the first-time seed ladder (issue #81): artists matching a declared genre. */
export async function findArtistsByGenres(genreKeys: readonly string[]): Promise<SeedArtistCandidate[]> {
  return findArtistsByGenresData(genreKeys)
}

/** Tier 2 of the first-time seed ladder (issue #81): top artists nationwide by peso. */
export async function findTopImportanceArtists(limit: number): Promise<SeedArtistCandidate[]> {
  return findTopImportanceArtistsData(limit)
}

/**
 * Geocodes a saved city into `taste_profiles.city_lat/lng` — re-exported so
 * `auth/service.ts`'s profile-save hook imports it from here instead of
 * reaching into `./syncCityCoordinates` directly (ADR 0001; this closed a
 * pre-existing violation).
 */
export async function syncCityCoordinates(
  supabase: Parameters<typeof syncCityCoordinatesData>[0],
  userId: string,
  city: string
): Promise<void> {
  return syncCityCoordinatesData(supabase, userId, city)
}
