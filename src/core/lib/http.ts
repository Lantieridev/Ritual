/**
 * Shared fetch helpers for the external API clients (Ticketmaster, Setlist.fm,
 * Spotify, Last.fm). None of them had a timeout or retry before — a single
 * hung upstream request blocked the awaiting Server Component indefinitely.
 *
 * Deliberately NOT `import 'server-only'` here: these are environment-agnostic
 * fetch wrappers with no secrets of their own, and setlistfm.ts (unlike the
 * other 3 clients) is intentionally importable from Client Components for its
 * pure types/utilities — importing a 'server-only'-guarded module from here
 * would break that.
 */

const DEFAULT_TIMEOUT_MS = 8000

/** fetch() that aborts after `timeoutMs` instead of hanging forever. */
export async function fetchWithTimeout(
    input: string,
    init: RequestInit = {},
    timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
        return await fetch(input, { ...init, signal: controller.signal })
    } finally {
        clearTimeout(timeout)
    }
}

/** True when a caught fetch error was our own timeout abort, not a real network failure. */
export function isTimeoutError(e: unknown): boolean {
    return e instanceof Error && e.name === 'AbortError'
}

/**
 * fetchWithTimeout with a single retry (short backoff) for transient 5xx
 * responses or network failures — never for 4xx (those are non-retryable:
 * a bad API key or a rate limit won't fix itself a second later).
 */
export async function fetchWithRetry(
    input: string,
    init: RequestInit = {},
    options: { timeoutMs?: number; retryDelayMs?: number } = {}
): Promise<Response> {
    const { timeoutMs = DEFAULT_TIMEOUT_MS, retryDelayMs = 500 } = options
    try {
        const res = await fetchWithTimeout(input, init, timeoutMs)
        if (res.status >= 500) {
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
            return fetchWithTimeout(input, init, timeoutMs)
        }
        return res
    } catch (e) {
        if (isTimeoutError(e)) throw e
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
        return fetchWithTimeout(input, init, timeoutMs)
    }
}
