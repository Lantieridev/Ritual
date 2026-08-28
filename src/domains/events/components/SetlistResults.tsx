'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, gql } from 'urql'
import { unwrapMutation } from '@/src/graphql/mutation-result'
import { routes } from '@/src/core/lib/routes'
import { formatDate } from '@/src/core/lib/utils'
import { safeHref } from '@/src/core/lib/validation'
import type { Setlist } from '@/src/core/lib/setlistfm'
import { parseSetlistDate } from '@/src/core/lib/setlistfm'

const AddExternalEventMutation = gql`
  mutation AddExternalEvent($input: AddExternalEventInput!, $artistNameForLineup: String, $notes: String) {
    addExternalEvent(input: $input, artistNameForLineup: $artistNameForLineup, notes: $notes) { eventId error }
  }
`

interface SetlistResultsProps {
    setlists: Setlist[]
}

function getSongs(setlist: Setlist): string[] {
    // Guardas por consistencia con `normalizeSetlist`, no por un fallo
    // observado: sobre 200 setlists reales de 10 artistas, la API siempre
    // devolvió `sets.set` como array (vacío cuando el show no tiene canciones
    // cargadas). Cuestan nada y cubren una deriva futura del contrato.
    return (setlist.sets?.set ?? []).flatMap((s) =>
        (s?.song ?? []).map((song) => song?.name).filter((name): name is string => Boolean(name))
    )
}

/**
 * Lista de shows pasados de Setlist.fm con botón "Agregar a mis recitales".
 * Muestra el setlist (canciones) de cada show.
 *
 * Cada fila enlaza a su página en setlist.fm y el pie acredita la fuente: los
 * términos de la API exigen un link de atribución cada vez que se muestran sus
 * datos, así que la atribución es parte del contrato de uso, no decoración.
 */
export function SetlistResults({ setlists }: SetlistResultsProps) {
    const router = useRouter()
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [, addExternalEvent] = useMutation(AddExternalEventMutation)

    async function handleAdd(setlist: Setlist) {
        setLoadingId(setlist.id)
        setErrors((prev) => { const next = { ...prev }; delete next[setlist.id]; return next })

        const isoDate = parseSetlistDate(setlist.eventDate)
        const songs = getSongs(setlist)
        const notes = songs.length > 0
            ? songs.map((song, i) => `${i + 1}. ${song}`).join('\n')
            : undefined

        // Sin `id` ni `url`: son para mostrar el resultado de la búsqueda, la
        // mutation nunca los lee al importar el show.
        const result = unwrapMutation<{ eventId?: string; error?: string }>(
            await addExternalEvent({
                input: {
                    title: `${setlist.artist.name} @ ${setlist.venue.name}`,
                    datetime: isoDate + 'T00:00:00Z',
                    venue: {
                        name: setlist.venue.name,
                        city: setlist.venue.city.name,
                        country: setlist.venue.city.country.name,
                    },
                    lineup: [setlist.artist.name],
                },
                artistNameForLineup: setlist.artist.name,
                notes,
            }),
            'addExternalEvent',
            'Error al guardar. Intentá de nuevo.'
        )

        if (result.error) {
            setErrors((prev) => ({ ...prev, [setlist.id]: result.error! }))
        } else if (result.eventId) {
            setAddedIds((prev) => new Set([...prev, setlist.id]))
            router.push(routes.events.detail(result.eventId))
        }
        setLoadingId(null)
    }

    if (setlists.length === 0) {
        return (
            <div className="mt-10 flex flex-col items-center gap-3 py-16 text-center">
                <p className="text-zinc-500 text-sm">No se encontraron shows pasados en Setlist.fm.</p>
                <p className="text-zinc-600 text-xs">Probá con el nombre exacto del artista en inglés.</p>
                <SetlistFmAttribution />
            </div>
        )
    }

    return (
        <>
        <ul className="mt-6 divide-y divide-white/[0.06]">
            {setlists.map((setlist) => {
                const isLoading = loadingId === setlist.id
                const isAdded = addedIds.has(setlist.id)
                const isExpanded = expandedId === setlist.id
                const error = errors[setlist.id]
                const isoDate = parseSetlistDate(setlist.eventDate)
                const dateLabel = formatDate(isoDate, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                })
                const allSongs = getSongs(setlist)
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
                                {safeHref(setlist.url) ? (
                                    <a
                                        href={safeHref(setlist.url)!}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-semibold text-white truncate hover:text-ritual-red-hover transition-colors inline-block max-w-full"
                                    >
                                        {setlist.artist.name} ↗
                                    </a>
                                ) : (
                                    <p className="font-semibold text-white truncate">{setlist.artist.name}</p>
                                )}
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
                                {error && (
                                    <p className="mt-1 text-xs text-red-400">{error}</p>
                                )}
                            </div>

                            {/* Acción */}
                            <div className="shrink-0">
                                <button
                                    type="button"
                                    disabled={isLoading || isAdded}
                                    onClick={() => handleAdd(setlist)}
                                    className={`inline-flex items-center justify-center rounded-lg border px-4 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${isAdded
                                            ? 'border-green-500/30 bg-green-500/10 text-green-400'
                                            : 'border-white/15 text-zinc-300 hover:border-white/30 hover:text-white hover:bg-white/5 disabled:opacity-50'
                                        }`}
                                >
                                    {isLoading ? 'Guardando…' : isAdded ? '✓ Guardado' : '+ Guardar'}
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
        <SetlistFmAttribution />
        </>
    )
}

/**
 * Atribución obligatoria por los términos de la API de Setlist.fm: "place an
 * attribution link each time you use setlist.fm data on your website". Va
 * también en el estado vacío, porque la consulta se hizo igual.
 */
function SetlistFmAttribution() {
    return (
        <p className="mt-6 text-[10px] uppercase tracking-[0.14em] text-zinc-600">
            Datos de shows pasados por{' '}
            <a
                href="https://www.setlist.fm/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 underline underline-offset-4 hover:text-zinc-300 transition-colors"
            >
                setlist.fm
            </a>
        </p>
    )
}
