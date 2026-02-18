'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addExternalEvent } from '@/src/domains/events/actions'
import { routes } from '@/src/core/lib/routes'
import { FutureEvent } from '@/src/core/types'

interface FutureEventsResultsProps {
    events: FutureEvent[]
    searchQuery?: string
    compact?: boolean // New: for wishlist view?
}

/**
 * Lista de eventos futuros (Last.fm).
 * Reutilizable en Buscar y Wishlist.
 */
export function FutureEventsResults({ events, searchQuery, compact }: FutureEventsResultsProps) {
    const router = useRouter()
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [, startTransition] = useTransition()

    function handleAdd(ev: FutureEvent) {
        setLoadingId(ev.id)
        setErrors((prev) => { const next = { ...prev }; delete next[ev.id]; return next })
        startTransition(async () => {
            try {
                const result = await addExternalEvent(
                    {
                        id: ev.id,
                        title: ev.title,
                        datetime: ev.datetime,
                        venue: ev.venue,
                        lineup: ev.lineup,
                        url: ev.url,
                    },
                    ev.lineup[0]
                )
                if (result.error) {
                    setErrors((prev) => ({ ...prev, [ev.id]: result.error! }))
                } else if (result.eventId) {
                    setAddedIds((prev) => new Set([...prev, ev.id]))
                    router.push(routes.events.detail(result.eventId))
                }
            } catch {
                setErrors((prev) => ({ ...prev, [ev.id]: 'Error al guardar.' }))
            } finally {
                setLoadingId(null)
            }
        })
    }

    if (events.length === 0) {
        if (compact) return <p className="text-xs text-zinc-500 italic">No se encontraron shows próximos.</p>
        return (
            <div className="mt-10 flex flex-col items-center gap-3 py-16 text-center">
                <p className="text-zinc-500 text-sm">
                    {searchQuery
                        ? `No se encontraron shows futuros para "${searchQuery}".`
                        : 'No se encontraron shows futuros.'}
                </p>
            </div>
        )
    }

    return (
        <ul className={`divide-y divide-white/[0.06] ${compact ? 'mt-2' : 'mt-6'}`}>
            {events.map((ev) => {
                const isLoading = loadingId === ev.id
                const isAdded = addedIds.has(ev.id)
                const error = errors[ev.id]
                const date = new Date(ev.datetime)
                const dateLabel = date.toLocaleDateString('es-AR', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: compact ? undefined : 'numeric', // hide year in compact?
                })
                const venueLabel = [ev.venue.name, ev.venue.city].filter(Boolean).join(', ')

                return (
                    <li
                        key={ev.id}
                        className={`flex flex-col sm:flex-row sm:items-center gap-4 py-4 group ${compact ? 'py-3' : ''}`}
                    >
                        {/* Fecha */}
                        <div className="w-24 shrink-0">
                            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                                {dateLabel}
                            </p>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white truncate text-sm">{ev.title}</p>
                            <p className="text-xs text-zinc-500 mt-0.5 truncate">
                                📍 {venueLabel}
                            </p>
                            {error && (
                                <p className="mt-1 text-xs text-red-400">{error}</p>
                            )}
                        </div>

                        {/* Acción */}
                        <div className="shrink-0">
                            <button
                                type="button"
                                disabled={isLoading || isAdded}
                                onClick={() => handleAdd(ev)}
                                className={`inline-flex items-center justify-center rounded border px-3 py-1.5 text-[10px] font-semibold transition-colors disabled:cursor-not-allowed ${isAdded
                                    ? 'border-green-500/30 bg-green-500/10 text-green-400'
                                    : 'border-white/15 text-zinc-300 hover:border-white/30 hover:text-white hover:bg-white/5 disabled:opacity-50'
                                    }`}
                            >
                                {isLoading ? '…' : isAdded ? '✓' : '+'}
                            </button>
                        </div>
                    </li>
                )
            })}
        </ul>
    )
}
