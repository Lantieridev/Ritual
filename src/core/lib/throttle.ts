/**
 * Rate-limits repeated calls to an external API without hand-rolling a
 * delay before every call site. Used by the Last.fm client/crons to stay at
 * or under 1 request/second (Last.fm ToS) and by Nominatim's existing 1
 * req/s policy.
 */

export interface ThrottleOptions {
    /** Extra random delay added on top of `minMs`, in the range [0, jitterMs). */
    jitterMs?: number
    /** Injectable for tests — defaults to a real `setTimeout`-backed wait. */
    sleep?: (ms: number) => Promise<void>
    /** Injectable for tests — defaults to `Math.random`. */
    random?: () => number
}

export type Throttle = () => Promise<void>

function defaultSleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Returns a function that, awaited before each external call, never lets two
 * calls proceed less than `minMs` apart (plus up to `jitterMs` of random
 * extra delay to avoid every call landing on the exact same cadence).
 */
export function createThrottle(minMs: number, options: ThrottleOptions = {}): Throttle {
    const { jitterMs = 0, sleep = defaultSleep, random = Math.random } = options
    let lastCallAt: number | null = null

    return async function throttle(): Promise<void> {
        // Nothing to space out from on the very first call — jitter only
        // makes sense between two calls, not as a delay before the first one.
        if (lastCallAt !== null) {
            const minWait = Math.max(0, minMs - (Date.now() - lastCallAt))
            const jitter = jitterMs > 0 ? random() * jitterMs : 0
            const totalWait = minWait + jitter
            if (totalWait > 0) await sleep(totalWait)
        }

        lastCallAt = Date.now()
    }
}
