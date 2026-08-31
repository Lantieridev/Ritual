import { createClient } from '@/src/core/lib/supabase/server'
import { blendTasteProfile } from '@/src/domains/taste/blend'
import { parseCoord } from '@/src/core/lib/geo'
import type { LatLng } from '@/src/core/lib/geo'
import type { ArtistImportance, TasteProfile, TasteSignal, TasteSource } from '@/src/domains/taste/types'
import { profilePriorSource } from '@/src/domains/taste/adapters/profilePrior'
import { attendanceSource } from '@/src/domains/taste/adapters/attendance'
import { wishlistSource } from '@/src/domains/taste/adapters/wishlist'
import { lastfmSource } from '@/src/domains/taste/adapters/lastfm'
import type { ActionResult } from '@/src/core/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/** One row of the canonical genre vocabulary (see `genres` in `20260912010000_genre_vocabulary.sql`). */
export interface GenreOption {
  key: string
  label: string
}

const DEFAULT_SOURCES: readonly TasteSource[] = [profilePriorSource, attendanceSource, wishlistSource, lastfmSource]

/**
 * The blended read model for one user. Sources run through `allSettled`
 * (spec "Source-pluggable read model"): a source that rejects — an RLS
 * denial, a transient DB error — is simply left out of `sources`, never
 * thrown, so one bad adapter can't take down the whole profile.
 */
export async function getTasteProfile(
  userId: string,
  now: Date = new Date(),
  sources: readonly TasteSource[] = DEFAULT_SOURCES
): Promise<TasteProfile> {
  const supabase = await createClient()
  const settled = await Promise.allSettled(sources.map((source) => source.collect({ userId, supabase })))
  const signals = settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
  const artistGenres = await loadArtistGenres(signals)
  return blendTasteProfile(signals, { now, artistGenres })
}

/** Genres for every artist referenced by an artist-kind signal, so blend can split an artist's weight across them. */
async function loadArtistGenres(signals: readonly TasteSignal[]): Promise<ReadonlyMap<string, readonly string[]>> {
  const artistIds = [...new Set(signals.filter((s) => s.kind === 'artist').map((s) => s.ref))]
  return getArtistGenres(artistIds)
}

/**
 * Public, batched read of `artist_genres` — change 2's ranking (`recommendations`
 * domain) needs the same mapping `loadArtistGenres` already queries privately
 * for the taste blend, so it's lifted here instead of duplicated.
 */
export async function getArtistGenres(artistIds: readonly string[]): Promise<Map<string, readonly string[]>> {
  if (artistIds.length === 0) return new Map()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('artist_genres')
    .select('artist_id, genre_key')
    .in('artist_id', artistIds as string[])
  if (error || !data) return new Map()

  const byArtist = new Map<string, string[]>()
  for (const row of data) {
    const list = byArtist.get(row.artist_id)
    if (list) list.push(row.genre_key)
    else byArtist.set(row.artist_id, [row.genre_key])
  }
  return byArtist
}

export interface RankingContext {
  declaredGenreKeys: string[]
  cityCoords: LatLng | null
}

/**
 * One owner-RLS read of the fields the ranking pure core needs beyond
 * `getTasteProfile`: the declared genre keys (for the declared-genres basis)
 * and the city coordinates `syncCityCoordinates` already wrote (for the
 * proximity factor) — no live geocoding here.
 */
export async function findRankingContext(userId: string): Promise<RankingContext | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('taste_profiles')
    .select('favorite_genre_keys, city_lat, city_lng')
    .eq('user_id', userId)
    .single()

  if (error || !data) return null

  const lat = parseCoord(data.city_lat, 'lat')
  const lng = parseCoord(data.city_lng, 'lng')

  return {
    declaredGenreKeys: data.favorite_genre_keys ?? [],
    cityCoords: lat !== null && lng !== null ? { lat, lng } : null,
  }
}

/** One artist candidate for the first-time seed ladder — `peso` is `null` when the artist has no `artist_importance` row yet (the caller floors it, same as the main strip's `computeImportance`). */
export interface SeedArtistCandidate {
  artistId: string
  name: string
  peso: number | null
}

/**
 * Artists whose declared genre matches (tier 1 of the seed ladder, issue
 * #81). Two queries instead of one nested filter — same reasoning as the
 * rest of this file: `artist_genres` has no direct relationship to
 * `artist_importance`, only to `artists`, so a single PostgREST embed can't
 * reach peso from a genre filter in one hop.
 */
export async function findArtistsByGenres(genreKeys: readonly string[]): Promise<SeedArtistCandidate[]> {
  if (genreKeys.length === 0) return []

  const supabase = await createClient()
  const { data: genreRows, error: genreError } = await supabase
    .from('artist_genres')
    .select('artist_id')
    .in('genre_key', genreKeys as string[])
  if (genreError || !genreRows) return []

  const artistIds = [...new Set(genreRows.map((row) => row.artist_id as string))]
  if (artistIds.length === 0) return []

  const { data, error } = await supabase
    .from('artists')
    .select('id, name, artist_importance ( peso )')
    .in('id', artistIds)
  if (error || !data) return []

  return data.map((row) => {
    const importance = row.artist_importance as unknown as { peso: number | null } | null
    return { artistId: row.id as string, name: row.name as string, peso: importance?.peso ?? null }
  })
}

/** Top artists nationwide by `peso` (tier 2 of the seed ladder) — public data, no user context needed. */
export async function findTopImportanceArtists(limit: number): Promise<SeedArtistCandidate[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('artist_importance')
    .select('artist_id, peso, artists ( name )')
    .not('peso', 'is', null)
    .order('peso', { ascending: false })
    .limit(limit)
  if (error || !data) return []

  return data
    .map((row) => ({
      artistId: row.artist_id as string,
      name: ((row.artists as unknown as { name: string } | null)?.name ?? '') as string,
      peso: row.peso as number,
    }))
    .filter((artist) => artist.name.length > 0)
}

/** Batched read of `artist_importance`, for change 2's ranking function. Empty ids never touch the DB. */
export async function getArtistImportance(artistIds: readonly string[]): Promise<Map<string, ArtistImportance>> {
  if (artistIds.length === 0) return new Map()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('artist_importance')
    .select('artist_id, peso, geo_rank, went_count')
    .in('artist_id', artistIds as string[])

  const result = new Map<string, ArtistImportance>()
  if (error || !data) return result

  for (const row of data) {
    result.set(row.artist_id, { artistId: row.artist_id, peso: row.peso, geoRank: row.geo_rank, wentCount: row.went_count })
  }
  return result
}

/** Public catalog read — no user session required, `genres` grants select to anon and authenticated. */
export async function listGenres(): Promise<GenreOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('genres')
    .select('key, label_es, sort')
    .order('sort', { ascending: true })

  if (error) {
    console.error('Error cargando géneros:', error)
    return []
  }

  return (data ?? []).map((row) => ({ key: row.key, label: row.label_es }))
}

/** The editable subset of `taste_profiles`, read for the profile edit page's defaults. */
export interface TasteProfileRow {
  genres: string[]
  birthYear: number | null
  lastfmUsername: string | null
}

/** Owner-only read (RLS) — mirrors `getProfile(userId)` in the auth domain. `null` if the row doesn't exist yet. */
export async function getTasteProfileRow(userId: string): Promise<TasteProfileRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('taste_profiles')
    .select('favorite_genre_keys, birth_year, lastfm_username')
    .eq('user_id', userId)
    .single()

  if (error || !data) return null

  return {
    genres: data.favorite_genre_keys ?? [],
    birthYear: data.birth_year,
    lastfmUsername: data.lastfm_username,
  }
}

/** Replaces the user's declared genres and birth year in one write — the profile edit form always sends the full picker state, never a partial update. */
export async function writeTasteProfile(
  supabase: SupabaseClient,
  userId: string,
  input: { genres: string[]; birthYear: number | null }
): Promise<ActionResult> {
  const { error } = await supabase.from('taste_profiles').upsert({
    user_id: userId,
    favorite_genre_keys: input.genres,
    birth_year: input.birthYear,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    console.error('Error guardando preferencias de gusto musical:', error)
    return { error: 'No pudimos guardar tus preferencias.' }
  }
  return {}
}

/** Persists a validated, matched Last.fm username after the import has already run — see `connectLastfm`. */
export async function setLastfmUsername(
  supabase: SupabaseClient,
  userId: string,
  username: string,
  syncedAt: string
): Promise<ActionResult> {
  const { error } = await supabase
    .from('taste_profiles')
    .update({ lastfm_username: username, lastfm_synced_at: syncedAt })
    .eq('user_id', userId)

  if (error) {
    console.error('Error guardando el usuario de Last.fm:', error)
    return { error: 'No pudimos conectar tu cuenta de Last.fm.' }
  }
  return {}
}

/**
 * Disconnects Last.fm: deletes the imports first, then nulls the username —
 * in that order, so a failed delete never leaves the username cleared with
 * stale rows still attributed to it (spec "Disconnect purges data").
 */
export async function removeLastfmConnection(supabase: SupabaseClient, userId: string): Promise<ActionResult> {
  const { error: deleteError } = await supabase.from('lastfm_imports').delete().eq('user_id', userId)
  if (deleteError) {
    console.error('Error borrando los imports de Last.fm:', deleteError)
    return { error: 'No pudimos desconectar tu cuenta de Last.fm.' }
  }

  const { error } = await supabase
    .from('taste_profiles')
    .update({ lastfm_username: null, lastfm_synced_at: null })
    .eq('user_id', userId)
  if (error) {
    console.error('Error desconectando Last.fm:', error)
    return { error: 'No pudimos desconectar tu cuenta de Last.fm.' }
  }
  return {}
}
