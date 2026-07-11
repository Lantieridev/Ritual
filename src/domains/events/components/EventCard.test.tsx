// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EventCard } from '@/src/domains/events/components/EventCard'
import type { EventWithRelations } from '@/src/core/types'

const baseEvent = {
  id: 'e1',
  name: 'Show de prueba',
  date: '2024-05-01T20:00:00Z',
  venues: { name: 'Niceto', city: 'CABA', country: 'AR' },
  lineups: [{ artists: { id: 'a1', name: 'Bandalos Chinos' } }],
} as EventWithRelations

describe('EventCard', () => {
  it('links to the event detail page', () => {
    render(<EventCard event={baseEvent} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/events/e1')
  })

  it('renders the event name, venue, and lineup', () => {
    render(<EventCard event={baseEvent} />)
    expect(screen.getByText('Show de prueba')).toBeInTheDocument()
    expect(screen.getByText('Niceto, CABA')).toBeInTheDocument()
    expect(screen.getByText('Bandalos Chinos')).toBeInTheDocument()
  })

  it('falls back to "Recital" when the event has no name', () => {
    render(<EventCard event={{ ...baseEvent, name: null }} />)
    expect(screen.getByText('Recital')).toBeInTheDocument()
  })

  it('falls back to "Sede por confirmar" when there is no venue', () => {
    render(<EventCard event={{ ...baseEvent, venues: null }} />)
    expect(screen.getByText('Sede por confirmar')).toBeInTheDocument()
  })

  it('omits the lineup section entirely when there is no lineup', () => {
    render(<EventCard event={{ ...baseEvent, lineups: [] }} />)
    expect(screen.queryByText('Bandalos Chinos')).not.toBeInTheDocument()
  })
})
