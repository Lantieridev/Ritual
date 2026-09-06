// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MorningAfterHero, PastOnlyHero, GuestHero } from '@/src/domains/events/components/HomeHeroStates'
import type { EventWithAttendance, EventWithRelations } from '@/src/domains/events/service'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/src/domains/events/attendance-actions', () => ({ saveMemory: vi.fn(async () => ({})) }))

// We need to render the components with degenerate data to ensure they don't crash
// and that undefined/null text doesn't leak into the DOM.

const emptyEvent: EventWithAttendance = {
  id: 'e1',
  name: null,
  date: '2026-06-15',
  venue_id: null,
  venues: null,
  lineups: null,
  attendance: [],
} as unknown as EventWithAttendance

describe('HomeHeroStates Edge Cases', () => {
  describe('Degenerate Event Data', () => {
    it('handles completely empty event in GuestHero (no lineups, no name, no venue)', () => {
      const { container } = render(<GuestHero event={emptyEvent as EventWithRelations} image={null} />)
      // Name falls back to 'Recital'
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Recital')
      
      // Should not contain 'undefined' or 'null' text
      expect(container.textContent).not.toMatch(/undefined|null/i)
      // Separator should not be doubled or dangling
      expect(container.textContent).not.toMatch(/·\s*·/)
      expect(container.textContent).not.toMatch(/^\s*·|·\s*$/)
    })

    it('handles venue without city in MorningAfterHero', () => {
      const eventWithVenueNoCity = {
        ...emptyEvent,
        venues: { name: 'Obras', city: null, country: 'AR' },
        attendance: [{ id: '1', status: 'went', rating: null, user_id: 'u1', review: null }]
      } as unknown as EventWithAttendance
      
      const { container } = render(<MorningAfterHero event={eventWithVenueNoCity} image={null} />)
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Cómo.*estuvo/i)
      
      expect(container.textContent).not.toMatch(/undefined|null/i)
      expect(container.textContent).not.toMatch(/·\s*·/)
      expect(screen.getByText('Recital · Obras · anoche')).toBeInTheDocument()
    })

    it('handles extremely long artist names', () => {
      const longName = 'A'.repeat(100)
      const eventWithLongName = {
        ...emptyEvent,
        name: longName
      }
      
      render(<GuestHero event={eventWithLongName} image={null} />)
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(longName)
      // It shouldn't crash.
    })

    it('handles missing image (null) vs URL', () => {
      const { container: containerNull } = render(<GuestHero event={emptyEvent} image={null} />)
      expect(containerNull.querySelector('.ritual-photo')).toBeNull()

      const { container: containerUrl } = render(<GuestHero event={emptyEvent} image="https://example.com/img.jpg" />)
      const photo = containerUrl.querySelector('.ritual-photo')
      expect(photo).toBeInTheDocument()
      expect(photo).toHaveStyle('background-image: url(https://example.com/img.jpg)')
    })

    it('handles rating null and undefined in PastOnlyHero', () => {
      const noRatingEvent = {
        ...emptyEvent,
        attendance: [{ id: '1', status: 'went', rating: null, user_id: 'u1', review: null }]
      } as unknown as EventWithAttendance
      
      const { container } = render(<PastOnlyHero event={noRatingEvent} yearsAgo={2} image={null} />)
      expect(container.textContent).not.toMatch(/undefined|null/i)
      expect(container.textContent).not.toMatch(/le pusiste/i)
    })

    it('never shows "hace 0 años": less than a year falls back to the last show seen', () => {
      const eventWithRating = {
        ...emptyEvent,
        attendance: [{ id: '1', status: 'went', rating: 5, user_id: 'u1', review: null }]
      } as unknown as EventWithAttendance

      const { container } = render(<PastOnlyHero event={eventWithRating} yearsAgo={0} image={null} />)
      expect(screen.getByText('Lo último que viste')).toBeInTheDocument()
      expect(screen.queryByText(/hace 0/i)).not.toBeInTheDocument()
      expect(container.textContent).not.toMatch(/undefined|null/i)
    })

    it('does not leave dangling separators in PastOnlyHero dateLine when rating is missing', () => {
      const noRatingEvent = {
        ...emptyEvent,
        attendance: [{ id: '1', status: 'went', rating: null, user_id: 'u1', review: null }]
      } as unknown as EventWithAttendance
      
      render(<PastOnlyHero event={noRatingEvent} yearsAgo={1} image={null} />)
      // The date line should just be the date, no ' · ' since the second part (rating) is null
      const dateLine = screen.getByText(/2026/i) // Matches the formatted date
      expect(dateLine.textContent).not.toMatch(/·/)
    })

    it('does not leave dangling separators in PastOnlyHero place when city is missing', () => {
      const venueNoCity = {
        ...emptyEvent,
        venues: { name: 'Luna Park', city: null }
      } as unknown as EventWithAttendance
      
      render(<PastOnlyHero event={venueNoCity} yearsAgo={1} image={null} />)
      const placeLine = screen.getByText('Luna Park')
      expect(placeLine.textContent).not.toMatch(/·/)
    })
  })
})
