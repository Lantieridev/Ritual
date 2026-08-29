'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { buildHomeFeed, type HomeFilter } from '@/src/domains/events/home-view'
import type { EventWithAttendance } from '@/src/domains/events/service'
import { routes } from '@/src/core/lib/routes'
import { formatDate } from '@/src/core/lib/utils'
import { StarRating, EmptyState } from '@/src/core/components/ui'

interface AgendaViewProps {
    events: EventWithAttendance[]
}

const TABS: { id: HomeFilter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'upcoming', label: 'Próximos' },
    { id: 'went', label: 'Vividos' },
]

/**
 * Vista de la agenda personal del usuario con pestañas (Todos, Próximos, Vividos)
 * y agrupamiento por año. Reutiliza `buildHomeFeed` para el filtrado en memoria.
 */
export function AgendaView({ events }: AgendaViewProps) {
    const [filter, setFilter] = useState<HomeFilter>('all')

    const { events: filteredEvents, byYear, years } = useMemo(
        () => buildHomeFeed(events, filter),
        [events, filter]
    )

    return (
        <div className="space-y-8">
            {/* Tabs */}
            <div className="flex gap-1 border-b border-ritual-border-subtle pb-4 overflow-x-auto">
                {TABS.map((tab) => {
                    const active = filter === tab.id
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setFilter(tab.id)}
                            className={`px-3 py-1.5 font-label text-[10px] tracking-[0.14em] uppercase transition-colors whitespace-nowrap ${
                                active
                                    ? 'text-white bg-ritual-surface-high'
                                    : 'text-ritual-gray-text hover:text-white hover:bg-ritual-surface'
                            }`}
                        >
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* Listado o estado vacío */}
            {filteredEvents.length === 0 ? (
                filter === 'all' ? (
                    <EmptyState
                        title="Todavía no cargaste nada"
                        action={{ label: 'Buscar shows', href: routes.events.search }}
                    />
                ) : filter === 'upcoming' ? (
                    <EmptyState
                        title="Nada agendado"
                        action={{ label: 'Buscar tu próximo show', href: routes.events.search }}
                    />
                ) : (
                    <EmptyState
                        title="Todavía no hay ningún talón"
                        action={{ label: 'Cargar a mano', href: routes.events.new }}
                    />
                )
            ) : (
                <div className="space-y-10">
                    {years.map((year) => (
                        <div key={year}>
                            <p className="font-label text-[10px] tracking-[0.14em] text-ritual-gray-text uppercase mb-3">
                                {year}
                            </p>
                            <ul className="divide-y divide-ritual-border-subtle">
                                {byYear[year].map((ev) => {
                                    const artists = ev.lineups?.map((l) => l.artists.name) ?? []
                                    const attendance = ev.attendance?.[0]
                                    const status = attendance?.status
                                    const rating = attendance?.rating
                                    const review = attendance?.review

                                    return (
                                        <li key={ev.id}>
                                            <Link
                                                href={routes.events.detail(ev.id)}
                                                className="group flex items-center gap-4 py-3"
                                            >
                                                <div className="w-16 shrink-0">
                                                    <p className="font-label text-[10px] text-ritual-gray-text uppercase">
                                                        {formatDate(ev.date, { day: 'numeric', month: 'short' })}
                                                    </p>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-dense font-extrabold text-ritual-bone truncate">
                                                        {ev.name || artists[0] || 'Recital'}
                                                    </p>
                                                    <p className="font-label text-[10px] text-ritual-gray-text mt-0.5 truncate">
                                                        {ev.venues?.name}
                                                    </p>
                                                    {review && (
                                                        <p className="font-body text-xs italic text-ritual-gray-text mt-1 truncate">
                                                            &ldquo;{review}&rdquo;
                                                        </p>
                                                    )}
                                                </div>
                                                {status === 'went' ? (
                                                    rating != null ? <StarRating value={rating} size="xs" /> : null
                                                ) : status === 'going' || status === 'interested' ? (
                                                    <span className="font-label text-[9px] tracking-[0.14em] uppercase px-2 py-0.5 border border-ritual-border bg-ritual-surface text-ritual-gray-text shrink-0">
                                                        {status === 'going' ? 'Voy a ir' : 'Me interesa'}
                                                    </span>
                                                ) : null}
                                                <span className="font-label text-[9px] tracking-[0.16em] text-ritual-red-hover uppercase opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                    Ver →
                                                </span>
                                            </Link>
                                        </li>
                                    )
                                })}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
