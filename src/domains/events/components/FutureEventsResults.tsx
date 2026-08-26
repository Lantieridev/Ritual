'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, gql } from 'urql'
import { unwrapMutation } from '@/src/graphql/mutation-result'
import { routes } from '@/src/core/lib/routes'
import { formatDate } from '@/src/core/lib/utils'
import { parseExternalDateTime } from '@/src/core/lib/dates'
import { FutureEvent } from '@/src/core/types'

const AddExternalEventMutation = gql`
  mutation AddExternalEvent($input: AddExternalEventInput!, $artistNameForLineup: String) {
    addExternalEvent(input: $input, artistNameForLineup: $artistNameForLineup) { eventId error }
  }
`

interface FutureEventsResultsProps {
    events: FutureEvent[]
    searchQuery?: string
    compact?: boolean // New: for wishlist view?
}

/**
 * Lista de eventos futuros (Ticketmaster).
 * Reutilizable en Buscar, Wishlist y la ficha de artista.
 */
export function FutureEventsResults({ events, searchQuery, compact }: FutureEventsResultsProps) {
    const router = useRouter()
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [, addExternalEvent] = useMutation(AddExternalEventMutation)

    async function handleAdd(ev: FutureEvent) {
        setLoadingId(ev.id)
        setErrors((prev) => { const next = { ...prev }; delete next[ev.id]; return next })

        // Sin `id` ni `url`: son para mostrar el resultado de la búsqueda, la
        // mutation nunca los lee al importar el show.
        const result = unwrapMutation<{ eventId?: string; error?: string }>(
            await addExternalEvent({
                input: {
                    title: ev.title,
                    datetime: ev.datetime,
                    venue: { name: ev.venue.name, city: ev.venue.city, country: ev.venue.country },
                    lineup: ev.lineup,
                },
                artistNameForLineup: ev.lineup[0],
            }),
            'addExternalEvent',
            'Error al guardar.'
        )

        if (result.error) {
            setErrors((prev) => ({ ...prev, [ev.id]: result.error! }))
        } else if (result.eventId) {
            setAddedIds((prev) => new Set([...prev, ev.id]))
            router.push(routes.events.detail(result.eventId))
        }
        setLoadingId(null)
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
                // Cada fuente externa emite la fecha en su propio formato y
                // algunas no son parseables. Con `new Date()` a secas, esas
                // caían en el label como el texto "Invalid Date"; mostrar el
                // crudo del sitio ("13 SEP") le dice algo al usuario.
                const date = parseExternalDateTime(ev.datetime)
                const dateLabel = date
                    ? formatDate(date, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: compact ? undefined : 'numeric',
                    })
                    : ev.datetime
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
