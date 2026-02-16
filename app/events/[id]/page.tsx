import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getEventById } from '@/src/lib/events'
import { Card, Button } from '@/src/components/ui'

interface EventDetailPageProps {
  params: Promise<{ id: string }>
}

/**
 * Página de detalle de un recital.
 * Server Component: carga el evento por id y lo muestra.
 */
export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params
  const event = await getEventById(id)

  if (!event) {
    notFound()
  }

  const venueLabel = event.venues
    ? [event.venues.name, event.venues.city].filter(Boolean).join(', ')
    : 'Sede por confirmar'

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6 md:p-8 font-sans">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-zinc-400 hover:text-yellow-500 mb-8 transition-colors"
      >
        ← Volver al listado
      </Link>

      <article>
        <header className="mb-8">
          <p className="text-sm text-zinc-400 font-medium uppercase tracking-widest">
            {new Date(event.date).toLocaleDateString('es-AR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-yellow-500 mt-1 tracking-tight">
            {event.name || 'Recital'}
          </h1>
        </header>

        <Card className="max-w-2xl">
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden>📍</span>
              <div>
                <p className="text-sm text-zinc-400 uppercase tracking-wider">Sede</p>
                <p className="text-lg text-white">{venueLabel}</p>
              </div>
            </div>

            {event.lineups && event.lineups.length > 0 && (
              <div className="pt-6 border-t border-white/10">
                <p className="text-sm text-zinc-400 uppercase tracking-wider mb-3">
                  Artistas en el lineup
                </p>
                <ul className="flex flex-wrap gap-2">
                  {event.lineups.map((row) => (
                    <li key={row.artists.id}>
                      <span className="inline-block bg-yellow-500/10 text-yellow-500 font-bold px-3 py-1.5 rounded-lg">
                        {row.artists.name}
                        {row.artists.genre && (
                          <span className="text-yellow-500/80 font-normal ml-1.5">
                            · {row.artists.genre}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      </article>
    </main>
  )
}
