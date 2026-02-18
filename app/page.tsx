import type { Metadata } from 'next'
import Link from 'next/link'
import { getEventsWithAttendance } from '@/src/domains/events/data'
import { routes } from '@/src/core/lib/routes'
import { LinkButton } from '@/src/core/components/ui'
import { Hero } from '@/src/core/components/home'

export const metadata: Metadata = {
  title: 'RITUAL — Tu historial de recitales',
  description: 'Registrá, recordá y revivé cada show que fuiste. Tu archivo musical personal.',
}

type Filter = 'all' | 'upcoming' | 'past' | 'interested' | 'going'

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  interested: { label: 'Me interesa', className: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
  going: { label: 'Voy', className: 'bg-white/10 text-zinc-200 border-white/20' },
  went: { label: 'Fui ✓', className: 'bg-white text-neutral-950 border-white' },
}

interface PageProps {
  searchParams: Promise<{ filter?: string }>
}

export default async function HomePage({ searchParams }: PageProps) {
  const { filter: rawFilter } = await searchParams
  const filter = (rawFilter as Filter) ?? 'all'

  const allEvents = await getEventsWithAttendance()
  const now = new Date()

  // Aplicar filtro
  const events = allEvents.filter((ev) => {
    const isPast = new Date(ev.date) < now
    const userAttendance = ev.attendance?.[0]
    const status = userAttendance?.status

    switch (filter) {
      case 'upcoming': return !isPast
      case 'past': return isPast
      case 'interested': return status === 'interested'
      case 'going': return status === 'going'
      default: return true
    }
  })

  // Agrupar por año
  const byYear = events.reduce<Record<string, typeof events>>((acc, ev) => {
    const year = new Date(ev.date).getFullYear().toString()
    if (!acc[year]) acc[year] = []
    acc[year].push(ev)
    return acc
  }, {})

  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a))

  const FILTERS: { value: Filter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'upcoming', label: 'Próximos' },
    { value: 'past', label: 'Pasados' },
    { value: 'interested', label: 'Me interesa' },
    { value: 'going', label: 'Voy' },
  ]

  return (
    <>
      <Hero />

      <section id="recitales" className="max-w-4xl mx-auto px-6 md:px-8 py-16">
        {/* Header de sección */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h2 className="text-xl font-bold tracking-tight text-white">
            Mis recitales
            {allEvents.length > 0 && (
              <span className="ml-2 text-sm font-normal text-zinc-600">
                {allEvents.length} en total
              </span>
            )}
          </h2>
          <LinkButton href={routes.events.new} variant="secondary" className="px-4 py-2 text-sm self-start sm:self-auto">
            + Cargar a mano
          </LinkButton>
        </div>

        {/* Filtros */}
        {allEvents.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-10">
            {FILTERS.map(({ value, label }) => (
              <Link
                key={value}
                href={value === 'all' ? '/' : `/?filter=${value}`}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${filter === value
                  ? 'bg-white text-neutral-950 font-semibold'
                  : 'border border-white/10 text-zinc-500 hover:text-zinc-300 hover:border-white/20'
                  }`}
              >
                {label}
              </Link>
            ))}
          </div>
        )}

        {/* Empty state */}
        {events.length === 0 && (
          <div className="flex flex-col items-center gap-5 py-24 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-zinc-300 mb-1">
                {filter === 'all' ? 'Todavía no hay recitales' : 'No hay recitales con este filtro'}
              </p>
              <p className="text-sm text-zinc-600 max-w-xs">
                {filter === 'all'
                  ? 'Buscá shows en Ticketmaster o Setlist.fm, o cargá uno a mano.'
                  : 'Probá con otro filtro o agregá más recitales.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              <LinkButton href={routes.events.search} variant="primary" className="px-5 py-2.5 text-sm">
                Buscar shows
              </LinkButton>
              <LinkButton href={routes.events.new} variant="secondary" className="px-5 py-2.5 text-sm">
                + Cargar a mano
              </LinkButton>
            </div>
          </div>
        )}

        {/* Timeline agrupado por año */}
        {events.length > 0 && (
          <div className="space-y-12">
            {years.map((year) => (
              <div key={year}>
                {/* Separador de año */}
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-600">
                    {year}
                  </span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-xs text-zinc-700">
                    {byYear[year].length} show{byYear[year].length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Lista de eventos del año */}
                <ul className="divide-y divide-white/[0.04]">
                  {byYear[year].map((ev) => {
                    const dateObj = new Date(ev.date)
                    const isPast = dateObj < now
                    const userAttendance = ev.attendance?.[0]
                    const status = userAttendance?.status
                    const memory = userAttendance?.memories?.[0]
                    const venueLabel = ev.venues
                      ? [ev.venues.name, ev.venues.city].filter(Boolean).join(', ')
                      : null
                    const artists = ev.lineups?.map((l) => l.artists.name) ?? []

                    return (
                      <li key={ev.id}>
                        <Link
                          href={routes.events.detail(ev.id)}
                          className="group flex items-start gap-5 py-4 hover:bg-white/[0.02] -mx-3 px-3 rounded-lg transition-colors"
                        >
                          {/* Fecha */}
                          <div className="w-14 shrink-0 text-center pt-0.5">
                            <p className="text-xs font-bold text-zinc-500 uppercase">
                              {dateObj.toLocaleDateString('es-AR', { month: 'short' })}
                            </p>
                            <p className="text-2xl font-bold text-white leading-none mt-0.5">
                              {dateObj.getDate()}
                            </p>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2 flex-wrap">
                              <p className={`font-semibold truncate ${isPast ? 'text-white' : 'text-zinc-100'}`}>
                                {ev.name || artists[0] || 'Recital'}
                              </p>
                              {status && STATUS_BADGE[status] && (
                                <span className={`inline-block text-[10px] font-semibold uppercase tracking-widest border rounded px-1.5 py-0.5 shrink-0 ${STATUS_BADGE[status].className}`}>
                                  {STATUS_BADGE[status].label}
                                </span>
                              )}
                            </div>
                            {venueLabel && (
                              <p className="text-sm text-zinc-500 mt-0.5 truncate">
                                📍 {venueLabel}
                              </p>
                            )}
                            {artists.length > 1 && (
                              <p className="text-xs text-zinc-600 mt-1 truncate">
                                {artists.slice(0, 3).join(' · ')}{artists.length > 3 ? ` +${artists.length - 3}` : ''}
                              </p>
                            )}
                            {/* Rating si existe */}
                            {memory?.rating && (
                              <div className="flex gap-0.5 mt-1.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <span key={s} className={`text-xs ${s <= memory.rating! ? 'text-white' : 'text-zinc-700'}`}>★</span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Flecha */}
                          <div className="shrink-0 text-zinc-700 group-hover:text-zinc-400 transition-colors pt-1">
                            →
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
