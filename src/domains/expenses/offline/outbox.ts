/**
 * Issue #10: on-device queue of expenses created without signal.
 *
 * Deliberately tiny — one object store, no library — because the queue is
 * append-only: entries are created, then either deleted (synced/discarded) or
 * flagged `failed`. Nothing here talks to the network; sync.ts drains it.
 */

export type OutboxStatus = 'pending' | 'failed'

export interface OutboxPayload {
  amount: number
  category: string
  note?: string
  eventId?: string
  date: string
}

export interface OutboxEntry {
  clientId: string
  payload: OutboxPayload
  createdAt: number
  status: OutboxStatus
  error?: string
}

/** Fired on `window` after every write so mounted lists can refresh. */
export const OUTBOX_CHANGED_EVENT = 'ritual:outbox-changed'

const DB_NAME = 'ritual-offline'
const STORE = 'pending_expenses'

let lastCreatedAt = 0

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'clientId' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = run(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(req.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

function notifyChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OUTBOX_CHANGED_EVENT))
}

async function getEntry(clientId: string): Promise<OutboxEntry | undefined> {
  return withStore('readonly', (store) => store.get(clientId) as IDBRequest<OutboxEntry | undefined>)
}

export async function enqueue(
  payload: OutboxPayload,
  clientId: string = crypto.randomUUID()
): Promise<OutboxEntry> {
  // Strictly increasing so ordering survives two enqueues in one millisecond.
  lastCreatedAt = Math.max(Date.now(), lastCreatedAt + 1)
  const entry: OutboxEntry = { clientId, payload, createdAt: lastCreatedAt, status: 'pending' }
  await withStore('readwrite', (store) => store.put(entry))
  notifyChanged()
  return entry
}

export async function listEntries(): Promise<OutboxEntry[]> {
  const all = await withStore('readonly', (store) => store.getAll() as IDBRequest<OutboxEntry[]>)
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function markFailed(clientId: string, error: string): Promise<void> {
  const entry = await getEntry(clientId)
  if (!entry) return
  await withStore('readwrite', (store) => store.put({ ...entry, status: 'failed', error }))
  notifyChanged()
}

export async function requeue(clientId: string, payload?: OutboxPayload): Promise<void> {
  const entry = await getEntry(clientId)
  if (!entry) return
  const { error: _error, ...rest } = entry
  await withStore('readwrite', (store) =>
    store.put({ ...rest, payload: payload ?? entry.payload, status: 'pending' })
  )
  notifyChanged()
}

export async function removeEntry(clientId: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(clientId))
  notifyChanged()
}
