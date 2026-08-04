/**
 * Use-case layer for the recommendations domain (ADR 0001): `getHomeSuggestions`
 * assembles the home ranking strip. It reaches `events` and `taste` ONLY
 * through their own `service.ts` — never `./data` directly, same seam as
 * `expenses/service.ts → events/service.ts`.
 */
import { listSuggestionCandidates } from '@/src/domains/events/service'
import type { EventWithAttendance, SuggestionCandidateRow } from '@/src/domains/events/service'
import { getTasteProfile, getArtistImportance, getArtistGenres, findRankingContext, listGenres } from '@/src/domains/taste/service'
import type { ArtistImportance, TasteBasis, TasteSourceId } from '@/src/domains/taste/service'
import { searchTicketmasterEvents } from '@/src/core/lib/ticketmaster'
import { getArtistImage } from '@/src/core/lib/artist-image'
import { toCandidates } from './candidates'
import { rankSuggestions } from './rank'
import type { RankedCandidate, StripMode, TicketmasterMatch, WishlistArtist } from './types'

/** Bounds the external Ticketmaster calls: same limit and per-artist slice as the "Cerca tuyo" precedent it replaces. */
const TM_ARTIST_LIMIT = 6
const TM_EVENTS_PER_ARTIST = 2

/** The strip shows at most its top-ranked 6 — only they pay the image lookup cost. */
const STRIP_SIZE = 6

export interface HomeSuggestionsHeading {
  basis: TasteBasis
  hasCoords: boolean
  sources: readonly TasteSourceId[]
  declaredGenreLabels: readonly string[]
}

export interface HomeSuggestionsCandidate extends RankedCandidate {
  image: string | null
}

export interface HomeSuggestions {
  heading: HomeSuggestionsHeading
  candidates: HomeSuggestionsCandidate[]
}

/** Every event id the user already has attendance on, any status — these are excluded from the candidates. */
function attendedEventIds(events: readonly EventWithAttendance[]): Set<string> {
  return new Set(events.map((event) => event.id))
}

/** How many times the user marked "went" to each artist, from the same `allEvents` the rest of Home already loaded. */
function seenCounts(events: readonly EventWithAttendance[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const event of events) {
    if (!(event.attendance ?? []).some((row) => row.status === 'went')) continue
    for (const lineupRow of event.lineups ?? []) {
      const artistId = lineupRow.artists?.id
      if (!artistId) continue
      counts.set(artistId, (counts.get(artistId) ?? 0) + 1)
    }
  }
  return counts
}

/**
 * Ticketmaster results for the first `TM_ARTIST_LIMIT` wishlist artists, up
 * to `TM_EVENTS_PER_ARTIST` each. A single artist's search rejecting is
 * dropped, not propagated — the strip degrades to fewer candidates, never an
 * error.
 */
async function fetchTicketmasterMatches(wishlistArtists: readonly WishlistArtist[]): Promise<TicketmasterMatch[]> {
  const artists = wishlistArtists.slice(0, TM_ARTIST_LIMIT)
  const settled = await Promise.allSettled(
    artists.map(async (artist): Promise<TicketmasterMatch[]> => {
      const { events } = await searchTicketmasterEvents({ keyword: artist.name })
      return events.slice(0, TM_EVENTS_PER_ARTIST).map((event) => ({ artist, event }))
    })
  )
  return settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
}

/**
 * Assembles the home ranking strip (issue #81): candidates from the catalog
 * and Ticketmaster, ranked against the user's taste and location. Every
 * source is fetched through `allSettled` so one failing read (an RLS denial,
 * a transient DB error, Ticketmaster timing out) degrades that source to a
 * neutral value instead of failing the whole strip (spec "Non-blocking
 * rendering and placement").
 *
 * `allEvents` is the same attendance-embedded event list `app/page.tsx`
 * already loads for the rest of Home (`listMyEvents`) — reused here instead
 * of re-querying attendance, both for "own events excluded" and for the
 * "seen" reason's went-counts.
 */
export async function getHomeSuggestions(
  userId: string | null,
  wishlistArtists: readonly WishlistArtist[],
  allEvents: readonly EventWithAttendance[],
  now: Date = new Date()
): Promise<HomeSuggestions> {
  const [candidateRowsResult, tasteResult, rankingContextResult, genresResult, tmMatchesResult] = await Promise.allSettled([
    listSuggestionCandidates(now),
    userId ? getTasteProfile(userId, now) : Promise.resolve(null),
    userId ? findRankingContext(userId) : Promise.resolve(null),
    listGenres(),
    fetchTicketmasterMatches(wishlistArtists),
  ])

  const candidateRows: SuggestionCandidateRow[] = candidateRowsResult.status === 'fulfilled' ? candidateRowsResult.value : []
  const taste = tasteResult.status === 'fulfilled' ? tasteResult.value : null
  const rankingContext = rankingContextResult.status === 'fulfilled' ? rankingContextResult.value : null
  const genres = genresResult.status === 'fulfilled' ? genresResult.value : []
  const tmMatches = tmMatchesResult.status === 'fulfilled' ? tmMatchesResult.value : []

  const basis: TasteBasis = taste?.basis ?? 'none'
  const mode: StripMode = basis === 'none' ? 'general' : 'personal'
  const userCoords = rankingContext?.cityCoords ?? null
  const declaredGenreKeys = new Set(rankingContext?.declaredGenreKeys ?? [])
  const declaredGenreLabels = genres.filter((genre) => declaredGenreKeys.has(genre.key)).map((genre) => genre.label)

  const candidates = toCandidates(candidateRows, tmMatches, attendedEventIds(allEvents))
  const allArtistIds = [...new Set(candidates.flatMap((candidate) => candidate.artistIds))]

  const [importance, artistGenres] = await Promise.all([
    getArtistImportance(allArtistIds).catch(() => new Map<string, ArtistImportance>()),
    getArtistGenres(allArtistIds).catch(() => new Map<string, readonly string[]>()),
  ])

  const ranked = rankSuggestions(candidates, {
    now,
    mode,
    userCoords,
    importance,
    taste: taste ? { artistAffinity: taste.artistAffinity, genreAffinity: taste.genreAffinity } : null,
    artistGenres,
    facts: {
      seenCounts: seenCounts(allEvents),
      wishlist: new Set(wishlistArtists.map((artist) => artist.id)),
      declaredGenres: declaredGenreKeys,
    },
  })

  const top = ranked.slice(0, STRIP_SIZE)
  const withImages = await Promise.all(
    top.map(async (candidate): Promise<HomeSuggestionsCandidate> => {
      const { image } = await getArtistImage(candidate.headliner)
      return { ...candidate, image }
    })
  )

  return {
    heading: { basis, hasCoords: userCoords !== null, sources: taste?.sources ?? [], declaredGenreLabels },
    candidates: withImages,
  }
}
