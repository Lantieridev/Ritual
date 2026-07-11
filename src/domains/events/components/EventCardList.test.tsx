// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EventCardList } from '@/src/domains/events/components/EventCardList'
import type { EventWithRelations } from '@/src/core/types'

const events = [
  { id: 'e1', name: 'Show 1', date: '2024-01-01', venue_id: null, venues: null, lineups: [] },
  { id: 'e2', name: 'Show 2', date: '2024-02-01', venue_id: null, venues: null, lineups: [] },
] as EventWithRelations[]

describe('EventCardList', () => {
  it('renders one EventCard per event', () => {
    render(<EventCardList events={events} />)
    expect(screen.getByText('Show 1')).toBeInTheDocument()
    expect(screen.getByText('Show 2')).toBeInTheDocument()
  })

  it('shows an empty-state message when there are no events', () => {
    render(<EventCardList events={[]} />)
    expect(screen.getByText('No hay recitales cargados todavía.')).toBeInTheDocument()
  })

  it('renders the emptyAction only in the empty state', () => {
    const { rerender } = render(
      <EventCardList events={[]} emptyAction={<button>Cargar recital</button>} />
    )
    expect(screen.getByRole('button', { name: 'Cargar recital' })).toBeInTheDocument()

    rerender(<EventCardList events={events} emptyAction={<button>Cargar recital</button>} />)
    expect(screen.queryByRole('button', { name: 'Cargar recital' })).not.toBeInTheDocument()
  })
})
