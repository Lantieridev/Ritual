/**
 * Domain-agnostic geo math (ADR 0001): haversine distance and a strict
 * lat/lng parser shared by `recommendations` (proximity factor) and
 * `ticketmaster.ts` (venue coordinates from the Discovery API).
 */

export interface LatLng {
    lat: number
    lng: number
}

const EARTH_RADIUS_KM = 6371

function toRadians(deg: number): number {
    return (deg * Math.PI) / 180
}

/** Great-circle distance between two points, in kilometers. */
export function haversineKm(a: LatLng, b: LatLng): number {
    const dLat = toRadians(b.lat - a.lat)
    const dLng = toRadians(b.lng - a.lng)
    const lat1 = toRadians(a.lat)
    const lat2 = toRadians(b.lat)

    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

const LAT_MAX = 90
const LNG_MAX = 180

/**
 * Parses a latitude/longitude that may arrive as a number or a numeric
 * string (Ticketmaster's Discovery v2 documents `location.latitude` as a
 * number, but external payloads are never trusted at face value). Anything
 * non-finite or out of range is treated as missing, never as a bad value to
 * throw on — callers fall back to a neutral proximity instead.
 */
export function parseCoord(value: unknown, kind: 'lat' | 'lng'): number | null {
    const num = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
    if (!Number.isFinite(num)) return null

    const max = kind === 'lat' ? LAT_MAX : LNG_MAX
    if (num < -max || num > max) return null

    return num
}
