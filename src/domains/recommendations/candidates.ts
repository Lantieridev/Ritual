/**
 * Turns the catalog's 0–90 day rows and the Ticketmaster wishlist matches
 * into one flat, deduped list of `SuggestionCandidate`s — the input
 * `rankSuggestions` scores. Pure: no I/O, no fetching, so `getHomeSuggestions`
 * (service.ts) is the only place that touches the database or Ticketmaster.
 */
import { parseCoord, type LatLng } from '@/src/core/lib/geo'
import { toDateOnly } from '@/src/core/lib/dates'
import { routes } from '@/src/core/lib/routes'
import type { SuggestionCandidateRow } from '@/src/domains/events/service'
import type { SuggestionCandidate, TicketmasterMatch } from './types'

/** Same fallback as `headlinerOf` in HomeHeroStates.tsx, adapted to the narrower candidates row shape. */
function catalogHeadliner(row: SuggestionCandidateRow): string {
    return row.lineups[0]?.artists?.name ?? row.name ?? 'Recital'
}

function catalogVenueCoords(row: SuggestionCandidateRow): LatLng | null {
    const lat = parseCoord(row.venues?.lat, 'lat')
    const lng = parseCoord(row.venues?.lng, 'lng')
    return lat !== null && lng !== null ? { lat, lng } : null
}

function toCatalogCandidates(rows: readonly SuggestionCandidateRow[], attendedEventIds: ReadonlySet<string>): SuggestionCandidate[] {
    return rows
        .filter((row) => !attendedEventIds.has(row.id))
        .map((row) => ({
            key: `catalog:${row.id}`,
            source: 'catalog',
            href: routes.events.detail(row.id),
            headliner: catalogHeadliner(row),
            artistIds: row.lineups.map((l) => l.artists?.id).filter((id): id is string => Boolean(id)),
            venueName: row.venues?.name ?? '',
            startsAt: row.date,
            venueCoords: catalogVenueCoords(row),
        }))
}

/** Same-artist, same-Argentina-calendar-day pairs already covered by a catalog event — a Ticketmaster duplicate of these is dropped. */
function catalogDedupeKeys(catalogCandidates: readonly SuggestionCandidate[]): Set<string> {
    const keys = new Set<string>()
    for (const candidate of catalogCandidates) {
        const day = toDateOnly(candidate.startsAt)
        for (const artistId of candidate.artistIds) keys.add(`${artistId}|${day}`)
    }
    return keys
}

/** Case-, accent- and whitespace-insensitive equality, per spec "Candidate assembly and dedupe". */
function normalizeName(name: string): string {
    return name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
}

function lineupNamesArtist(lineup: readonly string[], artistName: string): boolean {
    const target = normalizeName(artistName)
    return lineup.some((name) => normalizeName(name) === target)
}

function tmVenueCoords(venue: TicketmasterMatch['event']['venue']): LatLng | null {
    return venue.lat != null && venue.lng != null ? { lat: venue.lat, lng: venue.lng } : null
}

function toTicketmasterCandidates(matches: readonly TicketmasterMatch[], catalogKeys: ReadonlySet<string>): SuggestionCandidate[] {
    const candidates: SuggestionCandidate[] = []

    for (const { artist, event } of matches) {
        if (event.lineup.length === 0) continue
        if (!lineupNamesArtist(event.lineup, artist.name)) continue

        const dedupeKey = `${artist.id}|${toDateOnly(event.datetime)}`
        if (catalogKeys.has(dedupeKey)) continue

        candidates.push({
            key: `ticketmaster:${event.id}`,
            source: 'ticketmaster',
            href: routes.events.new,
            headliner: artist.name,
            artistIds: [artist.id],
            venueName: event.venue.name,
            startsAt: event.datetime,
            venueCoords: tmVenueCoords(event.venue),
        })
    }

    return candidates
}

/**
 * Combines catalog rows and Ticketmaster wishlist matches into one candidate
 * list: catalog events the user already attended are dropped, and a
 * Ticketmaster result is dropped when a catalog event already covers the
 * same artist on the same Argentina calendar day (catalog wins).
 */
export function toCandidates(
    catalogRows: readonly SuggestionCandidateRow[],
    tmMatches: readonly TicketmasterMatch[],
    attendedEventIds: ReadonlySet<string>
): SuggestionCandidate[] {
    const catalogCandidates = toCatalogCandidates(catalogRows, attendedEventIds)
    const catalogKeys = catalogDedupeKeys(catalogCandidates)
    const ticketmasterCandidates = toTicketmasterCandidates(tmMatches, catalogKeys)

    return [...catalogCandidates, ...ticketmasterCandidates]
}
