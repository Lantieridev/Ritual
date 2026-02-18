'use client'

import { useState, useTransition } from 'react'
import { addExternalEvent } from '@/src/domains/events/actions'
import type { Setlist } from '@/src/core/lib/setlistfm'
import { parseSetlistDate } from '@/src/core/lib/setlistfm'

interface SetlistResultsProps {
    setlists: Setlist[]
}

/**
 * Lista de shows pasados de Setlist.fm con botón "Agregar a mis recitales".
 * Muestra el setlist (canciones) de cada show.
 */
export function SetlistResults({ setlists }: SetlistResultsProps) {
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [, startTransition] = useTransition()

    function handleAdd(setlist: Setlist) {
        setLoadingId(setlist.id)
        startTransition(async () => {
            const isoDate = parseSetlistDate(setlist.eventDate)
            await addExternalEvent(
                {
                    id: setlist.id,
                    title: `${setlist.artist.name} @ ${setlist.venue.name}`,
                    datetime: isoDate + 'T00:00:00Z',
                    venue: {
                        name: setlist.venue.name,
                        city: setlist.venue.city.name,
                        country: setlist.venue.city.country.name,
                    },
                    lineup: [setlist.artist.name],
                    url: setlist.url,
                },
                setlist.artist.name
            )
            setLoadingId(null)
        })
    }

    if (setlists.length === 0) {
        return (
            <div className="mt-10 flex flex-col items-center gap-3 py-16 text-center">
                <p className="text-zinc-500 text-sm">No se encontraron shows pasados en Setlist.fm.</p>
                <p className="text-zinc-600 text-xs">Probá con el nombre exacto del artista en inglés.</p>
            </div>
        )
    }

    return (
        <ul className="mt-6 divide-y divide-white/[0.06]">
            {setlists.map((setlist) => {
                const isLoading = loadingId === setlist.id
                const isExpanded = expandedId === setlist.id
                const isoDate = parseSetlistDate(setlist.eventDate)
                const dateLabel = new Date(isoDate).toLocaleDateString('es-AR', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                })
                const allSongs = setlist.sets.set.flatMap((s) => s.song.map((song) => song.name))
                const venueLabel = [
                    setlist.venue.name,
                    setlist.venue.city.name,
                    setlist.venue.city.country.name,
                ]
                    .filter(Boolean)
                    .join(', ')

                return (
                    <li key={setlist.id} className="py-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 group">
                            {/* Fecha */}
                            <div className="w-32 shrink-0">
                                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                                    {dateLabel}
                                </p>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-white truncate">{setlist.artist.name}</p>
                                <p className="text-sm text-zinc-500 mt-0.5 truncate">
                                    📍 {venueLabel}
                                </p>
                                {allSongs.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setExpandedId(isExpanded ? null : setlist.id)}
                                        className="mt-1 text-[10px] uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors"
                                    >
                                        {isExpanded ? '▲ Ocultar setlist' : `▼ Ver setlist (${allSongs.length} canciones)`}
                                    </button>
                                )}
                            </div>

                            {/* Acción */}
                            <div className="shrink-0">
                                <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => handleAdd(setlist)}
                                    className="inline-flex items-center justify-center rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold text-zinc-300 hover:border-white/30 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? 'Guardando…' : '+ Guardar'}
                                </button>
                            </div>
                        </div>

                        {/* Setlist expandible */}
                        {isExpanded && allSongs.length > 0 && (
                            <div className="mt-3 ml-0 sm:ml-36 flex flex-wrap gap-1.5">
                                {allSongs.map((song, i) => (
                                    <span
                                        key={i}
                                        className="inline-block text-[11px] text-zinc-500 bg-white/5 border border-white/[0.06] rounded px-2 py-0.5"
                                    >
                                        {i + 1}. {song}
                                    </span>
                                ))}
                            </div>
                        )}
                    </li>
                )
            })}
        </ul>
    )
}
