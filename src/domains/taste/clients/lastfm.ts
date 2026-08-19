/**
 * Last.fm client for taste import: a user's top artists (signup/profile
 * connect) and Argentina's geo top artists (artist_importance refresh).
 * Reuses `core/lib/lastfm`'s BASE URL, `env.getLastFmApiKey`, and
 * `http.fetchWithTimeout` instead of re-declaring them — see ADR 0003 for
 * the shared `{data|null, error?}` graceful-degradation shape this follows.
 *
 * Distinct from `core/lib/lastfm.ts`'s `getLastFmArtistInfo`: this is the
 * only place that talks to `user.gettopartists`/`geo.gettopartists`, and the
 * only place that classifies Last.fm's rate-limit signals (error 29, HTTP
 * 429, HTTP 403) so callers can back off instead of retrying blindly.
 */
import 'server-only'
import { BASE } from '@/src/core/lib/lastfm'
import { getLastFmApiKey } from '@/src/core/lib/env'
import { fetchWithTimeout, isTimeoutError } from '@/src/core/lib/http'

/** One day — matches the daily refresh cadence of both crons that read this (JD-006). */
const TOP_ARTISTS_REVALIDATE_SECONDS = 86400

/** One hour — same cadence as `core/lib/lastfm.ts`'s existing `artist.getinfo` call; tags change rarely. */
const ARTIST_TAGS_REVALIDATE_SECONDS = 3600

const RATE_LIMIT_ERROR_CODE = 29
const NOT_FOUND_ERROR_CODE = 6

export interface LastFmTopArtist {
    name: string
    mbid?: string
    /** 1-based rank; from `@attr.rank` when present, else its position in the list. */
    rank: number
    listeners?: number
    playcount?: number
}

export interface LastFmTopArtistsResult {
    artists: LastFmTopArtist[] | null
    error?: string
    notFound?: boolean
    rateLimited?: boolean
}

interface CallResult {
    body: Record<string, unknown> | null
    error?: string
    notFound?: boolean
    rateLimited?: boolean
}

async function callLastFm(params: Record<string, string>, revalidateSeconds: number): Promise<CallResult> {
    const apiKey = getLastFmApiKey()
    if (!apiKey) {
        return { body: null, error: 'LASTFM_API_KEY no configurado.' }
    }

    const search = new URLSearchParams({ ...params, api_key: apiKey, format: 'json' })

    try {
        const res = await fetchWithTimeout(`${BASE}/?${search}`, {
            next: { revalidate: revalidateSeconds },
        })

        if (res.status === 429 || res.status === 403) {
            return { body: null, error: `Last.fm respondió con error ${res.status}.`, rateLimited: true }
        }
        if (!res.ok) {
            return { body: null, error: `Last.fm respondió con error ${res.status}.` }
        }

        const body = (await res.json()) as Record<string, unknown>
        if (typeof body.error === 'number') {
            const message = typeof body.message === 'string' ? body.message : 'Error de Last.fm.'
            if (body.error === RATE_LIMIT_ERROR_CODE) return { body: null, error: message, rateLimited: true }
            if (body.error === NOT_FOUND_ERROR_CODE) return { body: null, error: message, notFound: true }
            return { body: null, error: message }
        }

        return { body }
    } catch (e) {
        if (isTimeoutError(e)) {
            return { body: null, error: 'Last.fm tardó demasiado en responder. Probá de nuevo.' }
        }
        console.error('Last.fm call:', e)
        return { body: null, error: 'Error al conectar con Last.fm.' }
    }
}

function parseTopArtists(body: Record<string, unknown>): LastFmTopArtist[] {
    const topartists = body.topartists as { artist?: unknown } | undefined
    const rawArtists = Array.isArray(topartists?.artist)
        ? (topartists!.artist as Array<Record<string, unknown>>)
        : []

    return rawArtists.map((raw, index) => {
        const attr = raw['@attr'] as { rank?: string } | undefined
        const parsedRank = attr?.rank !== undefined ? Number(attr.rank) : NaN
        const rank = Number.isFinite(parsedRank) && parsedRank > 0 ? parsedRank : index + 1

        return {
            name: String(raw.name ?? ''),
            mbid: typeof raw.mbid === 'string' && raw.mbid ? raw.mbid : undefined,
            rank,
            listeners: raw.listeners !== undefined ? Number(raw.listeners) : undefined,
            playcount: raw.playcount !== undefined ? Number(raw.playcount) : undefined,
        }
    })
}

function toResult(call: CallResult): LastFmTopArtistsResult {
    if (!call.body) {
        return { artists: null, error: call.error, notFound: call.notFound, rateLimited: call.rateLimited }
    }
    return { artists: parseTopArtists(call.body) }
}

/** A user's most-played artists over `period` (default the last 12 months), capped at `limit` (default 50). */
export async function getLastFmUserTopArtists(
    username: string,
    options: { period?: string; limit?: number } = {}
): Promise<LastFmTopArtistsResult> {
    const { period = '12month', limit = 50 } = options
    const call = await callLastFm(
        { method: 'user.gettopartists', user: username.trim(), period, limit: String(limit) },
        TOP_ARTISTS_REVALIDATE_SECONDS
    )
    return toResult(call)
}

/** Argentina's most-played artists (default), one `limit`-sized page at a time. */
export async function getLastFmGeoTopArtists(
    options: { country?: string; limit?: number; page?: number } = {}
): Promise<LastFmTopArtistsResult> {
    const { country = 'Argentina', limit = 50, page = 1 } = options
    const call = await callLastFm(
        { method: 'geo.gettopartists', country, limit: String(limit), page: String(page) },
        TOP_ARTISTS_REVALIDATE_SECONDS
    )
    return toResult(call)
}

export interface LastFmArtistTagsResult {
    tags: string[] | null
    error?: string
    notFound?: boolean
    rateLimited?: boolean
}

/**
 * An artist's raw Last.fm tags, for the importance-refresh cron's tag-refresh
 * phase (unit 10). Distinct from `core/lib/lastfm.ts`'s `getLastFmArtistInfo`
 * (used by the artists domain's enrichment) so that phase also gets this
 * client's rate-limit classification instead of a silently swallowed 429/403.
 */
export async function getLastFmArtistTags(artistName: string): Promise<LastFmArtistTagsResult> {
    const call = await callLastFm(
        { method: 'artist.getinfo', artist: artistName.trim(), autocorrect: '1' },
        ARTIST_TAGS_REVALIDATE_SECONDS
    )
    if (!call.body) return { tags: null, error: call.error, notFound: call.notFound, rateLimited: call.rateLimited }

    const artist = call.body.artist as { tags?: { tag?: unknown } } | undefined
    const rawTags = Array.isArray(artist?.tags?.tag) ? (artist!.tags!.tag as Array<Record<string, unknown>>) : []
    return { tags: rawTags.map((tag) => String(tag.name ?? '')).filter(Boolean) }
}
