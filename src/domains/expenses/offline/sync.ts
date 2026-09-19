import { listEntries, markFailed, removeEntry, type OutboxEntry } from './outbox'

/**
 * How the server answered one queued expense.
 * - network:  never reached the resolver (offline, timeout, 5xx) → retry later.
 * - auth:     session expired → keep the entry, retry after sign-in.
 * - rejected: the server refused it (validation, deleted event) → needs the user.
 */
export type SendResult =
  | { ok: true; id: string }
  | { ok: false; kind: 'network' | 'auth' | 'rejected'; message: string }

export type SendExpense = (entry: OutboxEntry) => Promise<SendResult>

export interface FlushSummary {
  synced: number
  failed: number
  remaining: number
  /** True when another tab held the lock, so this call did nothing. */
  skipped: boolean
}

const LOCK_NAME = 'ritual-outbox-flush'

async function drain(send: SendExpense): Promise<FlushSummary> {
  let synced = 0
  let failed = 0

  const pending = (await listEntries()).filter((e) => e.status === 'pending')
  for (const entry of pending) {
    let result: SendResult
    try {
      result = await send(entry)
    } catch {
      break
    }

    if (result.ok) {
      await removeEntry(entry.clientId)
      synced++
    } else if (result.kind === 'rejected') {
      await markFailed(entry.clientId, result.message)
      failed++
    } else {
      // network / auth: nothing later in the queue will fare better right now.
      break
    }
  }

  const remaining = (await listEntries()).filter((e) => e.status === 'pending').length
  return { synced, failed, remaining, skipped: false }
}

/**
 * Drains the outbox oldest-first. Serialized across tabs with Web Locks; the
 * server-side (user_id, client_id) constraint covers any gap (and browsers
 * without Web Locks), so a double send is harmless.
 */
export async function flushOutbox(send: SendExpense): Promise<FlushSummary> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    const summary = await navigator.locks.request(LOCK_NAME, { ifAvailable: true }, (lock) =>
      lock ? drain(send) : null
    )
    return summary ?? { synced: 0, failed: 0, remaining: 0, skipped: true }
  }
  return drain(send)
}
