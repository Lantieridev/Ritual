import type { EventWithRelations } from '@/src/core/types'
import { formatDate } from '@/src/core/lib/utils'

export function generateEventJsonLd(event: EventWithRelations) {
  const mainArtist = event.lineups?.[0]?.artists?.name
  const title = event.name || mainArtist || 'Recital'
  const venueLabel = event.venues
    ? [event.venues.name, event.venues.city].filter(Boolean).join(', ')
    : 'Sede por confirmar'
  const dateLabel = formatDate(event.date)

  const performers =
    event.lineups && event.lineups.length > 0
      ? event.lineups.map((row) => ({
          '@type': 'PerformingGroup',
          name: row.artists.name,
          ...(row.artists.genre ? { genre: row.artists.genre } : {}),
        }))
      : undefined

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: title,
    startDate: event.date,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: event.venues?.name || 'Sede por confirmar',
      ...(event.venues?.city || event.venues?.country
        ? {
            address: {
              '@type': 'PostalAddress',
              ...(event.venues.city ? { addressLocality: event.venues.city } : {}),
              ...(event.venues.country ? { addressCountry: event.venues.country } : {}),
            },
          }
        : {}),
    },
    ...(performers && performers.length > 0
      ? { performer: performers.length === 1 ? performers[0] : performers }
      : {}),
    description: `${title} — ${dateLabel} · ${venueLabel}`,
  }
}
