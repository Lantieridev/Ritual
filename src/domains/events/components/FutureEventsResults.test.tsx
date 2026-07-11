// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockAddExternalEvent = vi.fn()
const mockPush = vi.fn()

vi.mock('@/src/domains/events/actions', () => ({
  addExternalEvent: (...args: unknown[]) => mockAddExternalEvent(...args),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

import { FutureEventsResults } from '@/src/domains/events/components/FutureEventsResults'
import type { FutureEvent } from '@/src/core/types'

const event: FutureEvent = {
  id: 'ev-1',
  title: 'Bandalos Chinos en Niceto',
  datetime: '2099-05-01T20:00:00Z',
  venue: { name: 'Niceto', city: 'CABA', country: 'AR' },
  lineup: ['Bandalos Chinos'],
}

describe('FutureEventsResults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a full empty state (non-compact) with the search query when there are no results', () => {
    render(<FutureEventsResults events={[]} searchQuery="Bandalos" />)
    expect(screen.getByText(/No se encontraron shows futuros para "Bandalos"/)).toBeInTheDocument()
  })

  it('shows a compact empty state when compact is true', () => {
    render(<FutureEventsResults events={[]} compact />)
    expect(screen.getByText('No se encontraron shows próximos.')).toBeInTheDocument()
  })

  it('renders the event title and venue', () => {
    render(<FutureEventsResults events={[event]} />)
    expect(screen.getByText('Bandalos Chinos en Niceto')).toBeInTheDocument()
    expect(screen.getByText(/Niceto, CABA/)).toBeInTheDocument()
  })

  it('adds the event and navigates to its detail page on success', async () => {
    mockAddExternalEvent.mockResolvedValue({ eventId: 'new-event-1' })
    render(<FutureEventsResults events={[event]} />)

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/events/new-event-1')
    })
    expect(mockAddExternalEvent).toHaveBeenCalledWith(
      { id: 'ev-1', title: event.title, datetime: event.datetime, venue: event.venue, lineup: event.lineup, url: undefined },
      'Bandalos Chinos'
    )
  })

  it('shows a per-event error and does not navigate when adding fails', async () => {
    mockAddExternalEvent.mockResolvedValue({ error: 'Ya existe un evento similar.' })
    render(<FutureEventsResults events={[event]} />)

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Ya existe un evento similar.')).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('disables the button once the event has been added', async () => {
    mockAddExternalEvent.mockResolvedValue({ eventId: 'new-event-1' })
    render(<FutureEventsResults events={[event]} />)

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeDisabled()
    })
  })
})
