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

import { getArtistImage, esUrlDeImagenSegura } from '@/src/core/lib/artist-image'
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
        vi.mocked(searchDeezerArtistImage).mockResolvedValue({ image: 'https://cdn-images.dzcdn.net/images/artist/abc/1000x1000.jpg' })

        await expect(getArtistImage('Divididos')).resolves.toEqual({ image: 'https://cdn-images.dzcdn.net/images/artist/abc/1000x1000.jpg', source: 'deezer' })
        expect(searchSpotifyArtist).not.toHaveBeenCalled()
    })

    it('prefiere Spotify cuando está configurado y encuentra la foto', async () => {
        vi.mocked(isSpotifyConfigured).mockReturnValue(true)
        vi.mocked(searchSpotifyArtist).mockResolvedValue({ artist: { images: [] } } as never)
        vi.mocked(getBestSpotifyImage).mockReturnValue('https://i.scdn.co/image/ab6761610000e5eb123')

        await expect(getArtistImage('Divididos')).resolves.toEqual({ image: 'https://i.scdn.co/image/ab6761610000e5eb123', source: 'spotify' })
        expect(searchDeezerArtistImage).not.toHaveBeenCalled()
    })

    it('cae en Deezer cuando Spotify está configurado pero no encuentra al artista', async () => {
        vi.mocked(isSpotifyConfigured).mockReturnValue(true)
        vi.mocked(searchSpotifyArtist).mockResolvedValue({ artist: null } as never)
        vi.mocked(searchDeezerArtistImage).mockResolvedValue({ image: 'https://cdn-images.dzcdn.net/images/artist/abc/1000x1000.jpg' })

        await expect(getArtistImage('Banda rara')).resolves.toEqual({ image: 'https://cdn-images.dzcdn.net/images/artist/abc/1000x1000.jpg', source: 'deezer' })
    })

    it('cae en Deezer cuando Spotify falla y devuelve su error', async () => {
        vi.mocked(isSpotifyConfigured).mockReturnValue(true)
        vi.mocked(searchSpotifyArtist).mockResolvedValue({ artist: null, error: 'Spotify tardó demasiado.' } as never)
        vi.mocked(searchDeezerArtistImage).mockResolvedValue({ image: 'https://cdn-images.dzcdn.net/images/artist/abc/1000x1000.jpg' })

        await expect(getArtistImage('Divididos')).resolves.toEqual({ image: 'https://cdn-images.dzcdn.net/images/artist/abc/1000x1000.jpg', source: 'deezer' })
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

describe('esUrlDeImagenSegura', () => {
    it('acepta una URL https normal de las fuentes reales', () => {
        expect(esUrlDeImagenSegura('https://cdn-images.dzcdn.net/images/artist/abc/1000x1000.jpg')).toBe(true)
        expect(esUrlDeImagenSegura('https://i.scdn.co/image/ab6761610000e5eb123')).toBe(true)
    })

    // El valor entra en style={{ backgroundImage: url(...) }}: un parentesis o
    // un punto y coma cierra la declaracion e inyecta CSS arbitrario.
    it('rechaza lo que romperia la declaracion CSS', () => {
        expect(esUrlDeImagenSegura('https://x.jpg); background: red; --x: url(a')).toBe(false)
        expect(esUrlDeImagenSegura('https://x.jpg"')).toBe(false)
        expect(esUrlDeImagenSegura("https://x.jpg'")).toBe(false)
        expect(esUrlDeImagenSegura('https://x .jpg')).toBe(false)
    })

    it('rechaza esquemas que no sean https', () => {
        expect(esUrlDeImagenSegura('http://x.jpg')).toBe(false)
        expect(esUrlDeImagenSegura('javascript:alert(1)')).toBe(false)
        expect(esUrlDeImagenSegura('data:image/png;base64,AAAA')).toBe(false)
    })

    it('rechaza lo que no es una URL', () => {
        expect(esUrlDeImagenSegura('no-es-una-url')).toBe(false)
        expect(esUrlDeImagenSegura('')).toBe(false)
    })
})

describe('presupuesto de tiempo', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(isSpotifyConfigured).mockReturnValue(false)
    })

    // Sin techo global, dos fuentes en serie con timeout de 8s cada una pueden
    // colgar el render hasta que la plataforma lo corte con un 504.
    it('devuelve null si la cadena tarda mas que el presupuesto', async () => {
        vi.useFakeTimers()
        vi.mocked(searchDeezerArtistImage).mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve({ image: 'tarde.jpg' }), 30000))
        )

        const promesa = getArtistImage('Divididos')
        await vi.advanceTimersByTimeAsync(6100)

        await expect(promesa).resolves.toEqual({ image: null, source: null })
        vi.useRealTimers()
    })
})
