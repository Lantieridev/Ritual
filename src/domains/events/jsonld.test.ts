import { describe, it, expect } from 'vitest'
import { generateEventJsonLd } from './jsonld'
import type { EventWithRelations } from '@/src/core/types'

describe('generateEventJsonLd', () => {
  it('generates schema.org Event JSON-LD structure with venue and lineups', () => {
    const mockEvent: EventWithRelations = {
      id: 'event-123',
      name: 'Los Fundamentalistas en Huracán',
      date: '2026-11-20',
      venue_id: 'venue-456',
      venues: {
        name: 'Estadio Tomás Adolfo Ducó',
        city: 'Buenos Aires',
        country: 'Argentina',
      },
      lineups: [
        {
          artists: {
            id: 'artist-1',
            name: 'Los Fundamentalistas del Aire Acondicionado',
            genre: 'Rock',
          },
        },
      ],
    }

    const jsonLd = generateEventJsonLd(mockEvent)

    expect(jsonLd).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Los Fundamentalistas en Huracán',
      startDate: '2026-11-20',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      location: {
        '@type': 'Place',
        name: 'Estadio Tomás Adolfo Ducó',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Buenos Aires',
          addressCountry: 'Argentina',
        },
      },
      performer: {
        '@type': 'PerformingGroup',
        name: 'Los Fundamentalistas del Aire Acondicionado',
        genre: 'Rock',
      },
      description: expect.stringContaining('Los Fundamentalistas en Huracán'),
    })
  })

  it('handles missing venue and lineups gracefully', () => {
    const mockEvent: EventWithRelations = {
      id: 'event-999',
      name: null,
      date: '2026-12-01',
      venue_id: null,
      venues: null,
      lineups: null,
    }

    const jsonLd = generateEventJsonLd(mockEvent)

    expect(jsonLd).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Recital',
      startDate: '2026-12-01',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      location: {
        '@type': 'Place',
        name: 'Sede por confirmar',
      },
      description: expect.stringContaining('Recital'),
    })
  })

  it('handles multiple performers', () => {
    const mockEvent: EventWithRelations = {
      id: 'event-festival',
      name: 'Festival Cosquín Rock',
      date: '2027-02-10',
      venue_id: 'venue-1',
      venues: {
        name: 'Aeroclub Santa María de Punilla',
        city: 'Córdoba',
        country: 'Argentina',
      },
      lineups: [
        { artists: { id: 'a1', name: 'Divididos', genre: 'Rock' } },
        { artists: { id: 'a2', name: 'Ciro y los Persas', genre: 'Rock' } },
      ],
    }

    const jsonLd = generateEventJsonLd(mockEvent)

    expect(jsonLd.performer).toEqual([
      { '@type': 'PerformingGroup', name: 'Divididos', genre: 'Rock' },
      { '@type': 'PerformingGroup', name: 'Ciro y los Persas', genre: 'Rock' },
    ])
  })
})
