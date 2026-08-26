import { isPastEvent } from '@/src/core/lib/dates'
import { getBestSpotifyImage, type SpotifyArtist } from '@/src/core/lib/spotify'
import { getBestLastFmImage, getLastFmTags, type LastFmArtist } from '@/src/core/lib/lastfm'
import type { ArtistWithEvents } from '@/src/domains/artists/service'

const MAX_BIO_LENGTH = 500
const MAX_TAGS = 5
const MAX_SIMILAR_ARTISTS = 5

export interface BestNight {
    event: ArtistWithEvents['events'][number]
    rating: number
    review: string | null
}

export interface ArtistEnrichment {
    heroImage: string | null
    tags: string[]
    similarArtists: { name: string }[]
    bio: string
    listeners: string | null
    spotifyFollowers: string | null
    spotifyUrl: string | null
    internalPast: ArtistWithEvents['events']
    internalUpcoming: ArtistWithEvents['events']
    /** Shows con status "went" — "veces que fuiste", no todo lo que está en lineups. */
    timesSeen: number
    /** Promedio de rating entre los shows calificados; null si ninguno tiene rating todavía. */
    averageRating: number | null
    /** El show mejor calificado, para la cita destacada. Null sin ningún rating. */
    bestNight: BestNight | null
}

/**
 * Deriva todos los campos de UI a partir de las respuestas ya resueltas de
 * Spotify/Last.fm y del historial interno del artista, separado del fetch y
 * del JSX de app/artists/[id]/page.tsx para que sea testeable sin renderizar
 * la página. No hace ningún fetch: recibe los resultados ya resueltos (o
 * null si la API no está configurada o falló).
 */
export function buildArtistEnrichment(
    artist: ArtistWithEvents,
    spotifyArtist: SpotifyArtist | null,
    lastfmArtist: LastFmArtist | null
): ArtistEnrichment {
    const heroImage = spotifyArtist
        ? getBestSpotifyImage(spotifyArtist.images)
        : lastfmArtist
            ? getBestLastFmImage(lastfmArtist.image)
            : null

    const tags = lastfmArtist ? getLastFmTags(lastfmArtist, MAX_TAGS) : artist.genre ? [artist.genre] : []

    const similarArtists = lastfmArtist?.similar?.artist?.slice(0, MAX_SIMILAR_ARTISTS) ?? []

    // Limpiar bio de Last.fm (viene con HTML y links)
    const rawBio = lastfmArtist?.bio?.summary ?? ''
    const bio = rawBio
        .replace(/<a[^>]*>.*?<\/a>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_BIO_LENGTH)

    const listeners = lastfmArtist?.stats?.listeners
        ? Number(lastfmArtist.stats.listeners).toLocaleString('es-AR')
        : null

    const spotifyFollowers = spotifyArtist?.followers?.total
        ? Number(spotifyArtist.followers.total).toLocaleString('es-AR')
        : null

    const spotifyUrl = spotifyArtist?.external_urls?.spotify ?? null

    const internalPast = artist.events.filter((e) => isPastEvent(e.date))
    const internalUpcoming = artist.events.filter((e) => !isPastEvent(e.date))

    const attendedEvents = artist.events.filter((e) => e.attendance?.[0]?.status === 'went')
    const timesSeen = attendedEvents.length

    const ratedEvents = attendedEvents.filter((e) => e.attendance?.[0]?.rating != null)
    const averageRating = ratedEvents.length > 0
        ? ratedEvents.reduce((sum, e) => sum + e.attendance[0].rating!, 0) / ratedEvents.length
        : null

    const bestNight = ratedEvents.length > 0
        ? ratedEvents.reduce((best, e) => (e.attendance[0].rating! > best.attendance[0].rating! ? e : best))
        : null

    return {
        heroImage,
        tags,
        similarArtists,
        bio,
        listeners,
        spotifyFollowers,
        spotifyUrl,
        internalPast,
        internalUpcoming,
        timesSeen,
        averageRating,
        bestNight: bestNight
            ? { event: bestNight, rating: bestNight.attendance[0].rating!, review: bestNight.attendance[0].review }
            : null,
    }
}
