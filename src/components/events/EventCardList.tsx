import { EventCard } from './EventCard'
import type { EventWithRelations } from '@/src/lib/types'

interface EventCardListProps {
  events: EventWithRelations[]
}

/**
 * Lista de tarjetas de recitales.
 * Server Component: recibe datos ya cargados (p. ej. desde page).
 */
export function EventCardList({ events }: EventCardListProps) {
  if (events.length === 0) {
    return (
      <p className="text-zinc-500 col-span-full">
        No hay recitales cargados todavía.
      </p>
    )
  }

  return (
    <>
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </>
  )
}
