// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ArtistProfile } from '@/src/domains/artists/components/ArtistProfile'
import type { ArtistWithEvents } from '@/src/domains/artists/data'
import type { FutureEvent } from '@/src/core/types'

const wentEvent: ArtistWithEvents['events'][number] = {
  id: 'e1',
  name: 'Show pasado',
  date: '2020-01-01',
  venues: { name: 'Niceto', city: 'CABA' },
  event_photos: [],
  attendance: [{ status: 'went', rating: 5, review: 'Inolvidable' }],
}

const artist: ArtistWithEvents = {
  id: 'a1',
  name: 'Bandalos Chinos',
  genre: 'Indie',
  image_url: null,
  spotify_id: null,
  events: [wentEvent],
}

const baseProps = {
  artist,
  bio: 'Banda de indie pop argentina.',
  similarArtists: [{ name: 'Usted Señalemelo' }],
  upcomingEvents: [] as FutureEvent[],
  internalUpcoming: [] as ArtistWithEvents['events'],
  internalPast: [wentEvent],
  timesSeen: 1,
  averageRating: 5,
  bestNight: { event: wentEvent, rating: 5, review: 'Inolvidable' },
  stats: { listeners: '100K', spotifyFollowers: '50K' },
}

describe('ArtistProfile', () => {
  it('renders the bio, similar artists, and stats', () => {
    render(<ArtistProfile {...baseProps} />)

    expect(screen.getByText('Banda de indie pop argentina.')).toBeInTheDocument()
    expect(screen.getByText('Usted Señalemelo')).toBeInTheDocument()
    expect(screen.getByText('100K')).toBeInTheDocument()
    expect(screen.getByText('50K')).toBeInTheDocument()
  })

  it('omits the bio section when there is no bio', () => {
    render(<ArtistProfile {...baseProps} bio="" />)
    expect(screen.queryByText('Biografía')).not.toBeInTheDocument()
  })

  it('shows the shows-seen count and average rating in the stats row', () => {
    render(<ArtistProfile {...baseProps} />)
    expect(screen.getByText('Shows vistos')).toBeInTheDocument()
    expect(screen.getByText('Tu promedio')).toBeInTheDocument()
    expect(screen.getByText('5.0')).toBeInTheDocument()
  })

  it('renders the best-night review as a standalone quote', () => {
    render(<ArtistProfile {...baseProps} />)
    expect(screen.getByText('“Inolvidable”')).toBeInTheDocument()
  })

  it('omits the best-night quote when there is no review, even with a rating', () => {
    render(<ArtistProfile {...baseProps} bestNight={{ event: wentEvent, rating: 5, review: null }} />)
    expect(screen.queryByText(/Inolvidable/)).not.toBeInTheDocument()
  })

  it('lists internal upcoming shows as primary cards, linking to their event page', () => {
    const upcoming: ArtistWithEvents['events'][number] = {
      id: 'e2',
      name: null,
      date: '2099-01-01',
      venues: { name: 'Movistar Arena', city: 'CABA' },
      event_photos: [],
      attendance: [],
    }
    render(<ArtistProfile {...baseProps} internalUpcoming={[upcoming]} />)

    expect(screen.getByText('Movistar Arena')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Movistar Arena/ })).toHaveAttribute('href', '/events/e2')
  })

  it('shows external (Ticketmaster) upcoming shows with a Tickets link', () => {
    const externalEvent: FutureEvent = {
      id: 'ext-1',
      title: 'Show en Gira',
      datetime: '2099-01-01T20:00:00Z',
      venue: { name: 'Estadio', city: 'Mendoza', country: 'AR' },
      lineup: ['Bandalos Chinos'],
      url: 'https://tickets.example.com',
    }
    render(<ArtistProfile {...baseProps} upcomingEvents={[externalEvent]} />)

    expect(screen.getByText('Estadio')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tickets →' })).toHaveAttribute('href', 'https://tickets.example.com')
  })

  it('lists the venues seen at, deduplicated', () => {
    const secondNightSameVenue: ArtistWithEvents['events'][number] = {
      ...wentEvent,
      id: 'e3',
      date: '2021-01-01',
    }
    render(<ArtistProfile {...baseProps} internalPast={[wentEvent, secondNightSameVenue]} />)

    // 2 filas en "las veces que fuiste" (una por show) + 1 chip deduplicado en "dónde las viste"
    expect(screen.getAllByText('Niceto')).toHaveLength(3)
  })

  it('shows an empty-state prompt with a manual-add link when nothing was ever attended', () => {
    render(<ArtistProfile {...baseProps} internalPast={[]} timesSeen={0} averageRating={null} bestNight={null} />)

    expect(screen.getByText(/Todavía no tenés shows de Bandalos Chinos/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cargar uno' })).toHaveAttribute('href', '/events/nuevo')
  })
})
