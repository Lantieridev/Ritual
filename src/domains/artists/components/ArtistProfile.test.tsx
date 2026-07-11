// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ArtistProfile } from '@/src/domains/artists/components/ArtistProfile'
import type { ArtistWithEvents } from '@/src/domains/artists/data'
import type { FutureEvent } from '@/src/core/types'

const artist: ArtistWithEvents = {
  id: 'a1',
  name: 'Bandalos Chinos',
  genre: 'Indie',
  image_url: null,
  spotify_id: null,
  events: [
    {
      id: 'e1',
      name: 'Show pasado',
      date: '2020-01-01',
      venues: { name: 'Niceto', city: 'CABA' },
      event_photos: [{ storage_path: 'a/b.jpg', caption: 'Buena toma' }],
    },
  ],
}

const baseProps = {
  artist,
  bio: 'Banda de indie pop argentina.',
  similarArtists: [{ name: 'Usted Señalemelo' }],
  upcomingEvents: [] as FutureEvent[],
  internalUpcoming: [] as ArtistWithEvents['events'],
  internalPast: [] as ArtistWithEvents['events'],
  stats: { listeners: '100K', spotifyFollowers: '50K' },
}

describe('ArtistProfile — overview tab', () => {
  it('renders the bio, similar artists, and stats by default', () => {
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

  it('always shows the shows-seen count, derived from the full events history', () => {
    render(<ArtistProfile {...baseProps} />)
    expect(screen.getByText('Shows vistos')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})

describe('ArtistProfile — history tab', () => {
  it('switches to the history tab and shows internal past shows', async () => {
    const past = artist.events
    render(<ArtistProfile {...baseProps} internalPast={past} />)

    await userEvent.click(screen.getByRole('button', { name: 'Historial' }))

    expect(screen.getByText('Historial de shows')).toBeInTheDocument()
    expect(screen.getByText('Show pasado')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Show pasado/ })).toHaveAttribute('href', '/events/e1')
  })

  it('shows external (Last.fm) upcoming shows with a Tickets link', async () => {
    const externalEvent: FutureEvent = {
      id: 'ext-1',
      title: 'Show en Gira',
      datetime: '2099-01-01T20:00:00Z',
      venue: { name: 'Estadio', city: 'Mendoza', country: 'AR' },
      lineup: ['Bandalos Chinos'],
      url: 'https://tickets.example.com',
    }
    render(<ArtistProfile {...baseProps} upcomingEvents={[externalEvent]} />)

    await userEvent.click(screen.getByRole('button', { name: 'Historial' }))

    expect(screen.getByText('Show en Gira')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tickets' })).toHaveAttribute(
      'href',
      'https://tickets.example.com'
    )
  })

  it('shows an empty state with a manual-add link when there is no history at all', async () => {
    render(<ArtistProfile {...baseProps} />)

    await userEvent.click(screen.getByRole('button', { name: 'Historial' }))

    expect(screen.getByText(/No tenés shows de este artista/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Cargar show manualmente/ })).toHaveAttribute(
      'href',
      '/events/nuevo'
    )
  })
})

describe('ArtistProfile — photos tab', () => {
  it('shows an empty state when there are no photos', async () => {
    render(<ArtistProfile {...baseProps} artist={{ ...artist, events: [] }} />)

    await userEvent.click(screen.getByRole('button', { name: 'Fotos' }))

    expect(screen.getByText('No hay fotos cargadas todavía.')).toBeInTheDocument()
  })

  it('collects photos from every event into a single grid', async () => {
    render(<ArtistProfile {...baseProps} />)

    await userEvent.click(screen.getByRole('button', { name: 'Fotos' }))

    expect(screen.getByAltText('Buena toma')).toBeInTheDocument()
  })
})
