import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWithTimeout, isTimeoutError, fetchWithRetry } from './http'

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('fetchWithTimeout', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('resolves normally when the request finishes before the timeout', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(200))
    vi.stubGlobal('fetch', mockFetch)

    const res = await fetchWithTimeout('https://example.com', {}, 5000)

    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('aborts with a timeout error when the request hangs past the timeout', async () => {
    vi.useFakeTimers()
    // A fetch that never resolves on its own — only the abort signal ends it.
    const mockFetch = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    })
    vi.stubGlobal('fetch', mockFetch)

    const promise = fetchWithTimeout('https://example.com', {}, 1000)
    const assertion = expect(promise).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(1000)
    await assertion

    const rejection = await promise.catch((e) => e)
    expect(isTimeoutError(rejection)).toBe(true)
  })
})

describe('isTimeoutError', () => {
  it('recognizes an AbortError', () => {
    expect(isTimeoutError(new DOMException('Aborted', 'AbortError'))).toBe(true)
  })

  it('does not treat other errors as timeouts', () => {
    expect(isTimeoutError(new TypeError('network error'))).toBe(false)
    expect(isTimeoutError('not an error')).toBe(false)
    expect(isTimeoutError(null)).toBe(false)
  })
})

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('returns the first response directly on success, without retrying', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(200))
    vi.stubGlobal('fetch', mockFetch)

    const promise = fetchWithRetry('https://example.com', {}, { retryDelayMs: 10 })
    await vi.runAllTimersAsync()
    const res = await promise

    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('retries once after a 5xx response and returns the retry result', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(503))
      .mockResolvedValueOnce(jsonResponse(200))
    vi.stubGlobal('fetch', mockFetch)

    const promise = fetchWithRetry('https://example.com', {}, { retryDelayMs: 10 })
    await vi.runAllTimersAsync()
    const res = await promise

    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('does not retry a 4xx response — a bad API key or rate limit will not fix itself', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(401))
    vi.stubGlobal('fetch', mockFetch)

    const promise = fetchWithRetry('https://example.com', {}, { retryDelayMs: 10 })
    await vi.runAllTimersAsync()
    const res = await promise

    expect(res.status).toBe(401)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('retries once after a thrown network error and returns the retry result', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new TypeError('network error'))
      .mockResolvedValueOnce(jsonResponse(200))
    vi.stubGlobal('fetch', mockFetch)

    const promise = fetchWithRetry('https://example.com', {}, { retryDelayMs: 10 })
    await vi.runAllTimersAsync()
    const res = await promise

    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
