'use client'

import { useCallback } from 'react'
import { useMutation } from 'urql'
import { CreateExpenseMutation } from './create-expense-mutation'
import { enqueue, removeEntry, type OutboxEntry, type OutboxPayload } from './outbox'
import { getOutboxOwner } from './outbox-owner'
import { makeSender } from './send'

export type CreateExpenseOutcome =
  | { status: 'synced'; id: string }
  | { status: 'queued'; clientId: string }
  | { status: 'rejected'; error: string }

/**
 * The one place that decides "online save or offline queue" for a new
 * expense. The entry is written to the outbox BEFORE the request, so a crash
 * or a killed tab mid-request cannot lose it; the clientId makes a retry
 * idempotent on the server.
 *
 * - synced:   the server accepted it; the outbox entry is gone.
 * - queued:   no network / session expired; it stays pending for the flusher.
 * - rejected: the server refused it (validation); nothing is kept, the caller
 *             shows the message inline exactly like before offline support.
 */
export function useCreateExpense() {
  const [, createExpenseM] = useMutation(CreateExpenseMutation)

  return useCallback(
    async (payload: OutboxPayload): Promise<CreateExpenseOutcome> => {
      const ownerId = getOutboxOwner()
      let entry: OutboxEntry
      let persisted = true
      try {
        // No known user means we can't say whose expense this is, so it must
        // not be queued: a later session could flush it into another account.
        if (!ownerId) throw new Error('no outbox owner')
        entry = await enqueue(payload, ownerId)
      } catch {
        // No owner, or storage blocked: still try the network, just without a safety net.
        persisted = false
        entry = { clientId: crypto.randomUUID(), ownerId: ownerId ?? '', payload, createdAt: Date.now(), status: 'pending' }
      }

      const result = await makeSender(createExpenseM)(entry)
      if (result.ok) {
        if (persisted) await removeEntry(entry.clientId)
        return { status: 'synced', id: result.id }
      }
      if (result.kind === 'rejected' || !persisted) {
        if (persisted) await removeEntry(entry.clientId)
        return { status: 'rejected', error: result.message }
      }
      return { status: 'queued', clientId: entry.clientId }
    },
    [createExpenseM]
  )
}
