import { EventCard } from './EventCard'
import type { EventWithRelations } from '@/src/core/types'

interface EventCardListProps {
  events: EventWithRelations[]
  /** Opcional: acción (ej. botón) para mostrar cuando la lista está vacía. */
  emptyAction?: React.ReactNode
}

export function EventCardList({ events, emptyAction }: EventCardListProps) {
  if (events.length === 0) {
    return (
      <div className="col-span-full flex flex-col items-center gap-4 py-12 text-center">
        <p className="text-zinc-500 max-w-sm">
          No hay recitales cargados todavía.
        </p>
        {emptyAction}
      </div>
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
