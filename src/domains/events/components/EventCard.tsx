import Link from 'next/link'
import { Card } from '@/src/core/components/ui'
import { routes } from '@/src/core/lib/routes'
import type { EventWithRelations } from '@/src/core/types'

interface EventCardProps {
  event: EventWithRelations
}

export function EventCard({ event }: EventCardProps) {
  const venueLabel = event.venues
    ? [event.venues.name, event.venues.city].filter(Boolean).join(', ')
    : 'Sede por confirmar'

  return (
    <Link href={routes.events.detail(event.id)} className="block group">
      <Card className="h-full">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-zinc-400 font-medium uppercase tracking-widest">
              {new Date(event.date).toLocaleDateString('es-AR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
            <h2 className="text-2xl font-bold text-white mt-1 group-hover:text-zinc-200 transition-colors">
              {event.name || 'Recital'}
            </h2>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-zinc-300">
              <span aria-hidden>📍</span>
              <span>{venueLabel}</span>
            </div>
            {event.lineups && event.lineups.length > 0 && (
              <div className="pt-4 border-t border-white/10 flex flex-wrap gap-2">
                {event.lineups.map((row) => (
                  <span
                    key={row.artists.id}
                    className="inline-block bg-white/10 text-zinc-300 text-xs font-medium px-2 py-1 rounded"
                  >
                    {row.artists.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  )
}
