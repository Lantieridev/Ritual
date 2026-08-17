import { createClient } from '@/src/core/lib/supabase/server'
import type { ActionResult } from '@/src/core/types'
import { MAX_GENRES, MIN_AGE_YEARS, MAX_AGE_YEARS } from './parseSignupTaste'
import { importLastfmForUser } from './importLastfmForUser'
import {
  listGenres as listGenresData,
  getTasteProfileRow,
  writeTasteProfile,
  setLastfmUsername,
  removeLastfmConnection,
} from './data'
import type { GenreOption, TasteProfileRow } from './data'

export type { GenreOption, TasteProfileRow }

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
