import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

import { searchDeezerArtistImage } from '@/src/core/lib/deezer'

const originalFetch = globalThis.fetch

function mockFetch(impl: () => Promise<unknown>) {
    globalThis.fetch = vi.fn(impl) as unknown as typeof fetch
}

function jsonResponse(body: unknown, ok = true, status = 200) {
    return Promise.resolve({ ok, status, json: () => Promise.resolve(body) })
}

describe('searchDeezerArtistImage', () => {
    beforeEach(() => vi.clearAllMocks())
    afterEach(() => { globalThis.fetch = originalFetch })

    it('no consulta la red con un nombre vacío', async () => {
        mockFetch(() => jsonResponse({}))
        await expect(searchDeezerArtistImage('   ')).resolves.toEqual({ image: null })
        expect(globalThis.fetch).not.toHaveBeenCalled()
    })

    it('prefiere la imagen más grande disponible', async () => {
        mockFetch(() => jsonResponse({
            data: [{ id: 1, name: 'Divididos', picture_medium: 'medium.jpg', picture_big: 'big.jpg', picture_xl: 'xl.jpg' }],
        }))
        await expect(searchDeezerArtistImage('Divididos')).resolves.toEqual({ image: 'xl.jpg' })
    })

    it('cae al tamaño siguiente cuando falta el más grande', async () => {
        mockFetch(() => jsonResponse({ data: [{ id: 1, name: 'X', picture_big: 'big.jpg' }] }))
        await expect(searchDeezerArtistImage('X')).resolves.toEqual({ image: 'big.jpg' })
    })

    it('descarta el placeholder genérico que devuelve cuando el artista no tiene foto', async () => {
        mockFetch(() => jsonResponse({
            data: [{ id: 1, name: 'X', picture_xl: 'https://cdn-images.dzcdn.net/images/artist//1000x1000.jpg' }],
        }))
        await expect(searchDeezerArtistImage('X')).resolves.toEqual({ image: null })
    })

    it('devuelve null sin error cuando no hay resultados', async () => {
        mockFetch(() => jsonResponse({ data: [] }))
        await expect(searchDeezerArtistImage('nadie')).resolves.toEqual({ image: null })
    })

    // El contrato del ADR 0003: los clientes externos nunca tiran, devuelven
    // el error para que quien llame decida.
    it('informa el error HTTP en vez de tirar', async () => {
        mockFetch(() => jsonResponse({}, false, 503))
        const r = await searchDeezerArtistImage('X')
        expect(r.image).toBeNull()
        expect(r.error).toContain('503')
    })

    it('informa el error que devuelve la propia API', async () => {
        mockFetch(() => jsonResponse({ error: { message: 'Quota limit exceeded' } }))
        const r = await searchDeezerArtistImage('X')
        expect(r.image).toBeNull()
        expect(r.error).toBe('Quota limit exceeded')
    })

    it('no propaga una caída de red', async () => {
        mockFetch(() => Promise.reject(new Error('ECONNREFUSED')))
        const r = await searchDeezerArtistImage('X')
        expect(r.image).toBeNull()
        expect(r.error).toBeTruthy()
    })

    it('distingue el timeout del wrapper compartido', async () => {
        mockFetch(() => {
            const e = new Error('aborted')
            e.name = 'AbortError'
            return Promise.reject(e)
        })
        const r = await searchDeezerArtistImage('X')
        expect(r.error).toContain('tardó demasiado')
    })
})
