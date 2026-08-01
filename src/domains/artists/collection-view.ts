import type { Artist } from '@/src/core/types'
import type { AggregatedEventStats } from '@/src/domains/stats/aggregate'

export interface CollectionArtist extends Artist {
    timesSeen: number
}

export interface ArtistShelves {
    /** 5+ veces — tu núcleo duro. */
    core: CollectionArtist[]
    /** 2-4 veces — volviste a verlas. */
    returned: CollectionArtist[]
    /** Exactamente 1 vez. */
    once: CollectionArtist[]
    /** En tu wishlist, todavía 0 veces — los huecos. */
    gaps: CollectionArtist[]
    /** Ni vista ni en wishlist — el resto del catálogo compartido, sin repetir a los de arriba. */
    catalog: CollectionArtist[]
}

const CORE_THRESHOLD = 5

/**
 * Agrupa el catálogo de artistas en las "estantes con significado" del
 * handoff, a partir de cuántas veces el usuario marcó "fui" a un show de
 * cada uno — no de cuántas veces aparece en un lineup cualquiera.
 */
export function buildArtistShelves(
    artists: Artist[],
    topArtistsSeen: AggregatedEventStats['topArtists'],
    wishlistIds: Set<string>
): ArtistShelves {
    const seenCountByName = new Map(topArtistsSeen.map((a) => [a.name, a.count]))

    const shelves: ArtistShelves = { core: [], returned: [], once: [], gaps: [], catalog: [] }

    for (const artist of artists) {
        const timesSeen = seenCountByName.get(artist.name) ?? 0
        const entry: CollectionArtist = { ...artist, timesSeen }

        if (timesSeen >= CORE_THRESHOLD) shelves.core.push(entry)
        else if (timesSeen >= 2) shelves.returned.push(entry)
        else if (timesSeen === 1) shelves.once.push(entry)
        else if (wishlistIds.has(artist.id)) shelves.gaps.push(entry)
        else shelves.catalog.push(entry)
    }

    return shelves
}

export interface CollectionTerritory {
    /** Cuántos artistas distintos viste al menos una vez. */
    uniqueArtistsSeen: number
    /** Cuántos de esos volviste a ver (2+ veces) — tu "fidelidad". */
    repeatedArtists: number
    /** Géneros más frecuentes entre lo que viste, de más a menos. */
    topGenres: Array<{ genre: string; count: number }>
    /** Tu venue con más shows — "tu sede casa". */
    homeVenue: { name: string; city: string | null; count: number } | null
}

const MAX_TOP_GENRES = 4

/**
 * "Tu territorio": de qué está hecha tu colección — para el header de
 * Colección, no depende del catálogo entero, solo de lo que el usuario vio.
 */
export function buildCollectionTerritory(
    artists: Artist[],
    topArtistsSeen: AggregatedEventStats['topArtists'],
    topVenuesSeen: AggregatedEventStats['topVenues']
): CollectionTerritory {
    const genreByName = new Map(artists.map((a) => [a.name, a.genre]))

    const genreCount: Record<string, number> = {}
    for (const { name } of topArtistsSeen) {
        const genre = genreByName.get(name)
        if (genre) genreCount[genre] = (genreCount[genre] ?? 0) + 1
    }
    const topGenres = Object.entries(genreCount)
        .map(([genre, count]) => ({ genre, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_TOP_GENRES)

    return {
        uniqueArtistsSeen: topArtistsSeen.length,
        repeatedArtists: topArtistsSeen.filter((a) => a.count >= 2).length,
        topGenres,
        homeVenue: topVenuesSeen[0] ?? null,
    }
}
