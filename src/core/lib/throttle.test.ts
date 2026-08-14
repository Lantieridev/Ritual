import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createThrottle } from '@/src/core/lib/throttle'

describe('createThrottle — fake timers', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('lets the first call through immediately', async () => {
        const throttle = createThrottle(1000)
        const start = Date.now()

        await throttle()

        expect(Date.now() - start).toBe(0)
    })

    it('waits at least minMs before a second call resolves', async () => {
        const throttle = createThrottle(1000)
        await throttle()
        const start = Date.now()

        const pending = throttle()
        await vi.advanceTimersByTimeAsync(1000)
        await pending

        expect(Date.now() - start).toBe(1000)
    })

    it('adds a deterministic jitter on top of minMs when random is injected', async () => {
        const throttle = createThrottle(1000, { jitterMs: 250, random: () => 0.5 })
        await throttle()
        const start = Date.now()

        const pending = throttle()
        await vi.advanceTimersByTimeAsync(1125)
        await pending

        expect(Date.now() - start).toBe(1125)
    })

    it('never resolves the second call before minMs + jitter elapsed', async () => {
        const throttle = createThrottle(1000, { jitterMs: 250, random: () => 1 })
        await throttle()

        let resolved = false
        const pending = throttle().then(() => {
            resolved = true
        })

        await vi.advanceTimersByTimeAsync(1000)
        expect(resolved).toBe(false)

        await vi.advanceTimersByTimeAsync(250)
        await pending
        expect(resolved).toBe(true)
    })

    it('bounds jitter within [0, jitterMs] using the default random source', async () => {
        const throttle = createThrottle(1000, { jitterMs: 250 })
        await throttle()

        let resolved = false
        const pending = throttle().then(() => {
            resolved = true
        })

        await vi.advanceTimersByTimeAsync(1000)
        await vi.advanceTimersByTimeAsync(250)
        await pending

        expect(resolved).toBe(true)
    })
})

describe('createThrottle — injected sleep', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('delegates the wait to a custom sleep function instead of real timers', async () => {
        const sleepCalls: number[] = []
        const sleep = vi.fn(async (ms: number) => {
            sleepCalls.push(ms)
        })
        const throttle = createThrottle(1000, { sleep })

        await throttle()
        await throttle()

        expect(sleepCalls).toEqual([1000])
    })
})
