'use client'

import { useCallback, useEffect, useState } from 'react'
import { useMutation } from 'urql'
import { CreateExpenseMutation } from './create-expense-mutation'
import { OUTBOX_CHANGED_EVENT, listEntries, type OutboxEntry } from './outbox'
import { getOutboxOwner } from './outbox-owner'
import { makeSender } from './send'
import { flushOutbox, type FlushSummary } from './sync'

/**
 * The current user's outbox entries (oldest first), kept fresh across writes
 * and owner changes. Entries queued by anyone else on this device never show.
 */
export function usePendingExpenses(eventId?: string): OutboxEntry[] {
  const [entries, setEntries] = useState<OutboxEntry[]>([])

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      const owner = getOutboxOwner()
      if (!owner) {
        setEntries([])
        return
      }
      listEntries(owner)
        .then((all) => {
          if (!cancelled) setEntries(eventId ? all.filter((e) => e.payload.eventId === eventId) : all)
        })
        .catch(() => {
          if (!cancelled) setEntries([])
        })
    }
    refresh()
    window.addEventListener(OUTBOX_CHANGED_EVENT, refresh)
    return () => {
      cancelled = true
      window.removeEventListener(OUTBOX_CHANGED_EVENT, refresh)
    }
  }, [eventId])

  return entries
}

/** Drains the current user's outbox through the real CreateExpense mutation. */
export function useOutboxFlush(): () => Promise<FlushSummary> {
  const [, createExpenseM] = useMutation(CreateExpenseMutation)
  return useCallback(async () => {
    const owner = getOutboxOwner()
    if (!owner) return { synced: 0, failed: 0, remaining: 0, skipped: true }
    return flushOutbox(makeSender(createExpenseM), owner)
  }, [createExpenseM])
}
