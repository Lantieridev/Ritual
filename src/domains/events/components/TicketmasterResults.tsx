'use client'

import { useState, useTransition } from 'react'
import { addEventFromBandsintown } from '@/src/domains/events/actions'
import type { TicketmasterEvent } from '@/src/core/lib/ticketmaster'

interface TicketmasterResultsProps {
    events: ReturnType<typeof import('@/src/core/lib/ticketmaster').normalizeTicketmasterEvent>[]
}

/**
 * Lista de eventos de Ticketmaster con botón "Agregar a mis recitales".
 * Cada card tiene loading independiente.
 */
export function TicketmasterResults({ events }: TicketmasterResultsProps) {
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [, startTransition] = useTransition()

    function handleAdd(ev: (typeof events)[0]) {
        setLoadingId(ev.id)
        startTransition(async () => {
            await addEventFromBandsintown(
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
            setLoadingId(null)
        })
    }

    if (events.length === 0) {
        return (
            <div className="mt-10 flex flex-col items-center gap-3 py-16 text-center">
                <p className="text-zinc-500 text-sm">No se encontraron shows futuros en Ticketmaster.</p>
                <p className="text-zinc-600 text-xs">Probá con otro artista o buscá en el historial pasado.</p>
            </div>
        )
    }

    return (
        <ul className="mt-6 divide-y divide-white/[0.06]">
            {events.map((ev) => {
                const isLoading = loadingId === ev.id
                const date = new Date(ev.datetime)
                const dateLabel = date.toLocaleDateString('es-AR', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                })
                const venueLabel = [ev.venue.name, ev.venue.city, ev.venue.country]
                    .filter(Boolean)
                    .join(', ')

                return (
                    <li
                        key={ev.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-4 py-4 group"
                    >
                        {/* Fecha */}
                        <div className="w-32 shrink-0">
                            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                                {dateLabel}
                            </p>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white truncate">{ev.title}</p>
                            <p className="text-sm text-zinc-500 mt-0.5 truncate">
                                📍 {venueLabel || 'Sede por confirmar'}
                            </p>
                            {ev.genre && (
                                <span className="inline-block mt-1 text-[10px] uppercase tracking-widest text-zinc-600 border border-white/10 rounded px-1.5 py-0.5">
                                    {ev.genre}
                                </span>
                            )}
                        </div>

                        {/* Precio (si existe) */}
                        {ev.priceRange && (
                            <div className="shrink-0 text-right hidden sm:block">
                                <p className="text-xs text-zinc-600">
                                    {ev.priceRange.currency} {ev.priceRange.min.toLocaleString()}
                                    {ev.priceRange.max !== ev.priceRange.min && ` – ${ev.priceRange.max.toLocaleString()}`}
                                </p>
                            </div>
                        )}

                        {/* Acción */}
                        <div className="shrink-0">
                            <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => handleAdd(ev)}
                                className="inline-flex items-center justify-center rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold text-zinc-300 hover:border-white/30 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? 'Guardando…' : '+ Guardar'}
                            </button>
                        </div>
                    </li>
                )
            })}
        </ul>
    )
}
