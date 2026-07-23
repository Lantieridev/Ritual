import { describe, it, expect } from 'vitest'

import { buildArtistEnrichment } from '@/src/domains/artists/enrichment'
import type { ArtistWithEvents } from '@/src/domains/artists/data'
import type { SpotifyArtist } from '@/src/core/lib/spotify'
import type { LastFmArtist } from '@/src/core/lib/lastfm'

function makeArtist(overrides: Partial<ArtistWithEvents> = {}): ArtistWithEvents {
  return {
    id: 'artist-1',
    name: 'Bandalos Chinos',
    genre: 'Indie',
    image_url: null,
    spotify_id: null,
    events: [],
    ...overrides,
  } as ArtistWithEvents
}

describe('buildArtistEnrichment', () => {
  it('falls back to the artist genre as a tag when Last.fm has no data', () => {
    const result = buildArtistEnrichment(makeArtist({ genre: 'Rock' }), null, null)

    expect(result.tags).toEqual(['Rock'])
    expect(result.heroImage).toBeNull()
    expect(result.bio).toBe('')
  })

  it('prefers the Spotify image over Last.fm when both are present', () => {
    const spotifyArtist = {
      images: [{ url: 'https://spotify.example/img.jpg', height: 640, width: 640 }],
      followers: { total: 12345 },
      external_urls: { spotify: 'https://open.spotify.com/artist/1' },
    } as unknown as SpotifyArtist

    const lastfmArtist = {
      image: [{ '#text': 'https://lastfm.example/img.jpg', size: 'large' }],
    } as unknown as LastFmArtist

    const result = buildArtistEnrichment(makeArtist(), spotifyArtist, lastfmArtist)

    expect(result.heroImage).toBe('https://spotify.example/img.jpg')
    expect(result.spotifyFollowers).toBe('12.345')
    expect(result.spotifyUrl).toBe('https://open.spotify.com/artist/1')
  })

  it('strips HTML/links from the Last.fm bio and caps it at 500 chars', () => {
    const lastfmArtist = {
      image: [],
      bio: { summary: 'Banda de rock. <a href="x">Read more on Last.fm</a>' },
    } as unknown as LastFmArtist

    const result = buildArtistEnrichment(makeArtist(), null, lastfmArtist)

    expect(result.bio).toBe('Banda de rock.')
  })

  it('splits the artist\'s internal events into past and upcoming', () => {
    const artist = makeArtist({
      events: [
        { id: 'e1', date: '2020-01-01', name: 'Show viejo' },
        { id: 'e2', date: '2099-01-01', name: 'Show futuro' },
      ] as ArtistWithEvents['events'],
    })

    const result = buildArtistEnrichment(artist, null, null)

    expect(result.internalPast.map((e) => e.id)).toEqual(['e1'])
    expect(result.internalUpcoming.map((e) => e.id)).toEqual(['e2'])
  })
})
