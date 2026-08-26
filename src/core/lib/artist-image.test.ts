import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('@/src/core/lib/spotify', () => ({
    isSpotifyConfigured: vi.fn(),
    searchSpotifyArtist: vi.fn(),
    getBestSpotifyImage: vi.fn(),
}))
vi.mock('@/src/core/lib/deezer', () => ({
    searchDeezerArtistImage: vi.fn(),
}))

import { getArtistImage } from '@/src/core/lib/artist-image'
import { isSpotifyConfigured, searchSpotifyArtist, getBestSpotifyImage } from '@/src/core/lib/spotify'
import { searchDeezerArtistImage } from '@/src/core/lib/deezer'

describe('getArtistImage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(searchDeezerArtistImage).mockResolvedValue({ image: null })
    })

    it('no consulta ninguna fuente con un nombre vacío', async () => {
        await expect(getArtistImage('  ')).resolves.toEqual({ image: null, source: null })
        expect(searchSpotifyArtist).not.toHaveBeenCalled()
        expect(searchDeezerArtistImage).not.toHaveBeenCalled()
    })

    // El caso por defecto de una instalación recién clonada, y el del deploy
    // actual: sin las dos variables de Spotify, el hero igual tiene que
    // conseguir una foto.
    it('usa Deezer cuando Spotify no está configurado, sin siquiera consultarlo', async () => {
        vi.mocked(isSpotifyConfigured).mockReturnValue(false)
        vi.mocked(searchDeezerArtistImage).mockResolvedValue({ image: 'deezer.jpg' })

        await expect(getArtistImage('Divididos')).resolves.toEqual({ image: 'deezer.jpg', source: 'deezer' })
        expect(searchSpotifyArtist).not.toHaveBeenCalled()
    })

    it('prefiere Spotify cuando está configurado y encuentra la foto', async () => {
        vi.mocked(isSpotifyConfigured).mockReturnValue(true)
        vi.mocked(searchSpotifyArtist).mockResolvedValue({ artist: { images: [] } } as never)
        vi.mocked(getBestSpotifyImage).mockReturnValue('spotify.jpg')

        await expect(getArtistImage('Divididos')).resolves.toEqual({ image: 'spotify.jpg', source: 'spotify' })
        expect(searchDeezerArtistImage).not.toHaveBeenCalled()
    })

    it('cae en Deezer cuando Spotify está configurado pero no encuentra al artista', async () => {
        vi.mocked(isSpotifyConfigured).mockReturnValue(true)
        vi.mocked(searchSpotifyArtist).mockResolvedValue({ artist: null } as never)
        vi.mocked(searchDeezerArtistImage).mockResolvedValue({ image: 'deezer.jpg' })

        await expect(getArtistImage('Banda rara')).resolves.toEqual({ image: 'deezer.jpg', source: 'deezer' })
    })

    it('cae en Deezer cuando Spotify falla y devuelve su error', async () => {
        vi.mocked(isSpotifyConfigured).mockReturnValue(true)
        vi.mocked(searchSpotifyArtist).mockResolvedValue({ artist: null, error: 'Spotify tardó demasiado.' } as never)
        vi.mocked(searchDeezerArtistImage).mockResolvedValue({ image: 'deezer.jpg' })

        await expect(getArtistImage('Divididos')).resolves.toEqual({ image: 'deezer.jpg', source: 'deezer' })
    })

    // Lo que garantiza que la Home no explote ni quede en loader infinito
    // cuando las dos fuentes están caídas.
    it('devuelve null sin tirar cuando ninguna fuente responde', async () => {
        vi.mocked(isSpotifyConfigured).mockReturnValue(true)
        vi.mocked(searchSpotifyArtist).mockResolvedValue({ artist: null, error: 'caído' } as never)
        vi.mocked(searchDeezerArtistImage).mockResolvedValue({ image: null, error: 'caído' })

        await expect(getArtistImage('Divididos')).resolves.toEqual({ image: null, source: null })
    })
})
