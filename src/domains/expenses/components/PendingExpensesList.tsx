'use client'

import { Button } from '@/src/core/components/ui'
import { removeEntry, requeue } from '@/src/domains/expenses/offline/outbox'
import { useOutboxFlush, usePendingExpenses } from '@/src/domains/expenses/offline/use-outbox'

function formatARS(amount: number) {
  return `$${amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

interface PendingExpensesListProps {
  /** Only show entries linked to this event (used on the event page). */
  eventId?: string
}

/**
 * Expenses saved on this device that the server hasn't confirmed yet.
 * `pending` ones sync by themselves; `failed` ones were refused by the
 * server and wait for the user to retry or discard them.
 */
export function PendingExpensesList({ eventId }: PendingExpensesListProps) {
  const entries = usePendingExpenses(eventId)
  const flush = useOutboxFlush()

  if (entries.length === 0) return null

  async function retry(clientId: string) {
    await requeue(clientId)
    await flush()
  }

  return (
    <ul className="space-y-2" aria-label="Gastos pendientes de sincronizar">
      {entries.map((entry) => (
        <li
          key={entry.clientId}
          className="border border-ritual-border bg-ritual-surface px-4 py-3 font-body text-sm text-ritual-bone"
        >
          <p>
            {formatARS(entry.payload.amount)} · {entry.payload.category}
            {entry.payload.note ? ` · ${entry.payload.note}` : ''}
          </p>
          {entry.status === 'pending' ? (
            <p className="font-label text-[10px] tracking-[0.14em] uppercase text-ritual-gray-text mt-1">
              Pendiente de sincronizar
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              <p role="alert" className="text-ritual-red-hover">
                No se pudo sincronizar: {entry.error}
              </p>
              <div className="flex gap-3">
                <Button type="button" variant="secondary" className="px-4 py-2" onClick={() => retry(entry.clientId)}>
                  Reintentar
                </Button>
                <Button type="button" variant="secondary" className="px-4 py-2" onClick={() => removeEntry(entry.clientId)}>
                  Descartar
                </Button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
