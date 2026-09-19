import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { enqueue, listEntries, markFailed } from './outbox'
import { flushOutbox, type SendExpense } from './sync'

const payload = { amount: 100, category: 'Entrada', date: '2024-01-01' }
const OWNER = 'user-1'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('flushOutbox', () => {
  it('sends pending entries oldest first and removes the synced ones', async () => {
    const a = await enqueue({ ...payload, note: 'a' }, OWNER)
    const b = await enqueue({ ...payload, note: 'b' }, OWNER)
    const send: SendExpense = vi.fn().mockResolvedValue({ ok: true, id: 'srv' })

    const summary = await flushOutbox(send, OWNER)

    expect(vi.mocked(send).mock.calls.map(([e]) => e.clientId)).toEqual([a.clientId, b.clientId])
    expect(summary).toEqual({ synced: 2, failed: 0, remaining: 0, skipped: false })
    expect(await listEntries(OWNER)).toEqual([])
  })

  it('stops at the first network failure and keeps everything pending', async () => {
    await enqueue(payload, OWNER)
    await enqueue(payload, OWNER)
    const send: SendExpense = vi.fn().mockResolvedValue({ ok: false, kind: 'network', message: 'offline' })

    const summary = await flushOutbox(send, OWNER)

    expect(send).toHaveBeenCalledTimes(1)
    expect(summary).toMatchObject({ synced: 0, failed: 0, remaining: 2 })
    expect((await listEntries(OWNER)).every((e) => e.status === 'pending')).toBe(true)
  })

  it('stops on an expired session and keeps the entries pending', async () => {
    await enqueue(payload, OWNER)
    const send: SendExpense = vi.fn().mockResolvedValue({ ok: false, kind: 'auth', message: 'Iniciá sesión' })

    const summary = await flushOutbox(send, OWNER)

    expect(summary).toMatchObject({ synced: 0, remaining: 1 })
    expect((await listEntries(OWNER))[0].status).toBe('pending')
  })

  it('marks a rejected entry failed and keeps draining the rest', async () => {
    const bad = await enqueue({ ...payload, amount: 0 }, OWNER)
    await enqueue({ ...payload, note: 'ok' }, OWNER)
    const send: SendExpense = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, kind: 'rejected', message: 'El monto debe ser mayor a 0.' })
      .mockResolvedValueOnce({ ok: true, id: 'srv' })

    const summary = await flushOutbox(send, OWNER)

    expect(summary).toEqual({ synced: 1, failed: 1, remaining: 0, skipped: false })
    const left = await listEntries(OWNER)
    expect(left).toHaveLength(1)
    expect(left[0]).toMatchObject({ clientId: bad.clientId, status: 'failed', error: 'El monto debe ser mayor a 0.' })
  })

  it('treats a throwing sender like a network failure', async () => {
    await enqueue(payload, OWNER)
    const send: SendExpense = vi.fn().mockRejectedValue(new Error('boom'))

    const summary = await flushOutbox(send, OWNER)

    expect(summary).toMatchObject({ synced: 0, remaining: 1 })
  })

  it('never sends entries that belong to another user, even though the session is the current one', async () => {
    await enqueue({ ...payload, note: 'mine' }, OWNER)
    const theirs = await enqueue({ ...payload, note: 'theirs' }, 'user-2')
    const send: SendExpense = vi.fn().mockResolvedValue({ ok: true, id: 'srv' })

    await flushOutbox(send, OWNER)

    expect(vi.mocked(send)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(send).mock.calls[0][0].payload.note).toBe('mine')
    expect(await listEntries('user-2')).toEqual([expect.objectContaining({ clientId: theirs.clientId, status: 'pending' })])
  })

  it('skips failed entries', async () => {
    const e = await enqueue(payload, OWNER)
    await markFailed(e.clientId, 'x')
    const send: SendExpense = vi.fn()

    await flushOutbox(send, OWNER)

    expect(send).not.toHaveBeenCalled()
  })

  it('does nothing when another tab holds the flush lock', async () => {
    await enqueue(payload, OWNER)
    vi.stubGlobal('navigator', {
      locks: { request: vi.fn((_name, _opts, cb) => cb(null)) },
    })
    const send: SendExpense = vi.fn()

    const summary = await flushOutbox(send, OWNER)

    expect(send).not.toHaveBeenCalled()
    expect(summary.skipped).toBe(true)
  })

  it('runs inside the lock when navigator.locks is available', async () => {
    await enqueue(payload, OWNER)
    const request = vi.fn((_name, _opts, cb) => cb({ name: 'lock' }))
    vi.stubGlobal('navigator', { locks: { request } })
    const send: SendExpense = vi.fn().mockResolvedValue({ ok: true, id: 'srv' })

    const summary = await flushOutbox(send, OWNER)

    expect(request).toHaveBeenCalledWith('ritual-outbox-flush', { ifAvailable: true }, expect.any(Function))
    expect(summary.synced).toBe(1)
  })
})
