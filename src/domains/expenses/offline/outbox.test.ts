import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import {
  enqueue,
  listEntries,
  markFailed,
  requeue,
  removeEntry,
  type OutboxPayload,
} from './outbox'

const payload: OutboxPayload = { amount: 100, category: 'Entrada', date: '2024-01-01' }

beforeEach(() => {
  // A fresh database per test; outbox.ts opens the DB lazily on every call.
  globalThis.indexedDB = new IDBFactory()
})

describe('outbox', () => {
  it('enqueues a pending entry with a generated clientId', async () => {
    const entry = await enqueue(payload)

    expect(entry.status).toBe('pending')
    expect(entry.clientId).toMatch(/^[0-9a-f-]{36}$/)
    expect(await listEntries()).toEqual([entry])
  })

  it('lists entries oldest first, even when created in the same millisecond', async () => {
    const a = await enqueue({ ...payload, note: 'a' })
    const b = await enqueue({ ...payload, note: 'b' })
    const c = await enqueue({ ...payload, note: 'c' })

    const ids = (await listEntries()).map((e) => e.clientId)
    expect(ids).toEqual([a.clientId, b.clientId, c.clientId])
  })

  it('marks an entry failed with the server message', async () => {
    const entry = await enqueue(payload)

    await markFailed(entry.clientId, 'El monto debe ser mayor a 0.')

    const [stored] = await listEntries()
    expect(stored.status).toBe('failed')
    expect(stored.error).toBe('El monto debe ser mayor a 0.')
  })

  it('requeues a failed entry, optionally with an edited payload', async () => {
    const entry = await enqueue(payload)
    await markFailed(entry.clientId, 'boom')

    await requeue(entry.clientId, { ...payload, amount: 250 })

    const [stored] = await listEntries()
    expect(stored.status).toBe('pending')
    expect(stored.error).toBeUndefined()
    expect(stored.payload.amount).toBe(250)
  })

  it('removes an entry', async () => {
    const entry = await enqueue(payload)

    await removeEntry(entry.clientId)

    expect(await listEntries()).toEqual([])
  })

  it('ignores markFailed/requeue for an unknown clientId', async () => {
    await expect(markFailed('missing', 'x')).resolves.toBeUndefined()
    await expect(requeue('missing')).resolves.toBeUndefined()
    expect(await listEntries()).toEqual([])
  })
})
