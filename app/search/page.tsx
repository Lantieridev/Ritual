import type { Metadata } from 'next'
import Link from 'next/link'
import { PageShell } from '@/src/core/components/layout'
import { routes } from '@/src/core/lib/routes'
import { supabase } from '@/src/core/lib/supabase'

export const metadata: Metadata = {
    title: 'Buscar | RITUAL',
    description: 'Buscá entre tus eventos, artistas y venues guardados.',
}

interface SearchPageProps {
    searchParams: Promise<{ q?: string }>
}

async function globalSearch(query: string) {
    const q = `%${query}%`

    const [eventsRes, artistsRes, venuesRes] = await Promise.all([
        supabase
            .from('events')
            .select('id, name, date')
            .ilike('name', q)
            .order('date', { ascending: false })
            .limit(8),
        supabase
            .from('artists')
            .select('id, name, genre')
            .ilike('name', q)
            .limit(8),
        supabase
            .from('venues')
            .select('id, name, city, country')
            .ilike('name', q)
            .limit(8),
    ])

    return {
        events: eventsRes.data ?? [],
        artists: artistsRes.data ?? [],
        venues: venuesRes.data ?? [],
    }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
    const { q } = await searchParams
    const query = q?.trim() ?? ''
    const results = query.length >= 2 ? await globalSearch(query) : null
    const totalResults = results
        ? results.events.length + results.artists.length + results.venues.length
        : 0

    return (
        <PageShell
            backHref={routes.home}
            backLabel="← Inicio"
            title="Buscar"
            description="Buscá entre tus eventos, artistas y venues."
        >
            {/* Search input */}
            <form method="GET" action={routes.search} className="mb-8">
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-lg pointer-events-none">
                        🔍
                    </span>
                    <input
                        type="search"
                        name="q"
                        defaultValue={query}
                        placeholder="Nombre de artista, evento o venue..."
                        autoFocus
                        autoComplete="off"
                        className="w-full rounded-xl border border-white/15 bg-white/[0.04] pl-11 pr-4 py-3.5 text-white placeholder-zinc-600 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 text-base"
                    />
                </div>
            </form>

            {/* Results */}
            {query.length >= 2 && results && (
                <div className="space-y-8">
                    {totalResults === 0 && (
                        <p className="text-zinc-500 text-center py-8">
                            Sin resultados para <strong className="text-zinc-400">&quot;{query}&quot;</strong>
                        </p>
                    )}

                    {/* Events */}
                    {results.events.length > 0 && (
                        <section>
                            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">
                                Eventos ({results.events.length})
                            </p>
                            <ul className="space-y-2">
                                {results.events.map((ev) => (
                                    <li key={ev.id}>
                                        <Link
                                            href={routes.events.detail(ev.id)}
                                            className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15 px-4 py-3 transition-all group"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className="text-lg flex-shrink-0">🎵</span>
                                                <span className="font-medium text-white group-hover:text-zinc-200 truncate">
                                                    {ev.name || 'Recital'}
                                                </span>
                                            </div>
                                            <span className="text-sm text-zinc-600 whitespace-nowrap">
                                                {new Date(ev.date).toLocaleDateString('es-AR', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric',
                                                })}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* Artists */}
                    {results.artists.length > 0 && (
                        <section>
                            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">
                                Artistas ({results.artists.length})
                            </p>
                            <ul className="space-y-2">
                                {results.artists.map((artist) => (
                                    <li key={artist.id}>
                                        <Link
                                            href={routes.artists.detail(artist.id)}
                                            className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15 px-4 py-3 transition-all group"
                                        >
                                            <span className="text-lg flex-shrink-0">🎤</span>
                                            <div className="min-w-0">
                                                <p className="font-medium text-white group-hover:text-zinc-200 truncate">
                                                    {artist.name}
                                                </p>
                                                {artist.genre && (
                                                    <p className="text-xs text-zinc-600">{artist.genre}</p>
                                                )}
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* Venues */}
                    {results.venues.length > 0 && (
                        <section>
                            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">
                                Venues ({results.venues.length})
                            </p>
                            <ul className="space-y-2">
                                {results.venues.map((venue) => (
                                    <li key={venue.id}>
                                        <Link
                                            href={routes.venues.detail(venue.id)}
                                            className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15 px-4 py-3 transition-all group"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className="text-lg flex-shrink-0">📍</span>
                                                <span className="font-medium text-white group-hover:text-zinc-200 truncate">
                                                    {venue.name}
                                                </span>
                                            </div>
                                            {venue.city && (
                                                <span className="text-sm text-zinc-600 whitespace-nowrap">{venue.city}</span>
                                            )}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>
            )}

            {query.length > 0 && query.length < 2 && (
                <p className="text-zinc-600 text-sm text-center py-4">Escribí al menos 2 caracteres para buscar.</p>
            )}

            {!query && (
                <p className="text-zinc-600 text-sm text-center py-8">
                    Escribí el nombre de un artista, evento o venue para buscar entre tus datos.
                </p>
            )}
        </PageShell>
    )
}
