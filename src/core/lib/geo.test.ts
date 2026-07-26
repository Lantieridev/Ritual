import { describe, it, expect } from 'vitest'
import { haversineKm, parseCoord } from '@/src/core/lib/geo'

describe('haversineKm', () => {
    it('is 0 km for the same point', () => {
        expect(haversineKm({ lat: -34.6037, lng: -58.3816 }, { lat: -34.6037, lng: -58.3816 })).toBe(0)
    })

    it('matches a known pair: Buenos Aires to La Plata (~50km)', () => {
        const caba = { lat: -34.6037, lng: -58.3816 }
        const laPlata = { lat: -34.9214, lng: -57.9544 }

        expect(haversineKm(caba, laPlata)).toBeCloseTo(53, 0)
    })

    it('is ~half the Earth circumference for antipodal points', () => {
        const north = { lat: 0, lng: 0 }
        const antipode = { lat: 0, lng: 180 }

        expect(haversineKm(north, antipode)).toBeCloseTo(Math.PI * 6371, 0)
    })
})

describe('parseCoord', () => {
    it('accepts a finite number in range', () => {
        expect(parseCoord(-34.6, 'lat')).toBe(-34.6)
        expect(parseCoord(-58.3, 'lng')).toBe(-58.3)
    })

    it('accepts a numeric string', () => {
        expect(parseCoord('-34.6', 'lat')).toBe(-34.6)
    })

    it('rejects an empty string', () => {
        expect(parseCoord('', 'lat')).toBeNull()
    })

    it('rejects a non-numeric string', () => {
        expect(parseCoord('abc', 'lat')).toBeNull()
    })

    it('rejects NaN', () => {
        expect(parseCoord(NaN, 'lat')).toBeNull()
    })

    it('rejects Infinity', () => {
        expect(parseCoord(Infinity, 'lat')).toBeNull()
    })

    it('rejects a latitude out of range (91)', () => {
        expect(parseCoord(91, 'lat')).toBeNull()
    })

    it('accepts a longitude up to 180 but rejects 181', () => {
        expect(parseCoord(180, 'lng')).toBe(180)
        expect(parseCoord(181, 'lng')).toBeNull()
    })

    it('rejects undefined', () => {
        expect(parseCoord(undefined, 'lat')).toBeNull()
    })
})
