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

import { SetlistResults } from '@/src/domains/events/components/SetlistResults'
import type { Setlist } from '@/src/core/lib/setlistfm'

const setlist: Setlist = {
  id: 'sl-1',
  eventDate: '25-12-2024',
  artist: { mbid: '', name: 'Bandalos Chinos', sortName: '', url: '' },
  venue: {
    id: 'v1',
    name: 'Niceto',
    city: { id: 'c1', name: 'CABA', country: { code: 'AR', name: 'Argentina' } },
  },
  sets: { set: [{ song: [{ name: 'Cumbia Rara' }, { name: 'Ela' }] }] },
  url: 'https://setlist.fm/sl-1',
  lastUpdated: '',
}

describe('SetlistResults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows an empty state when there are no setlists', () => {
    render(<SetlistResults setlists={[]} />)
    expect(screen.getByText('No se encontraron shows pasados en Setlist.fm.')).toBeInTheDocument()
  })

  it('renders the artist and venue', () => {
    render(<SetlistResults setlists={[setlist]} />)
    expect(screen.getByText('Bandalos Chinos')).toBeInTheDocument()
    expect(screen.getByText(/Niceto, CABA, Argentina/)).toBeInTheDocument()
  })

  it('expands and collapses the song list', async () => {
    render(<SetlistResults setlists={[setlist]} />)

    expect(screen.queryByText('1. Cumbia Rara')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Ver setlist \(2 canciones\)/ }))
    expect(screen.getByText('1. Cumbia Rara')).toBeInTheDocument()
    expect(screen.getByText('2. Ela')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Ocultar setlist/ }))
    expect(screen.queryByText('1. Cumbia Rara')).not.toBeInTheDocument()
  })

  it('omits the setlist toggle entirely when there are no songs', () => {
    const emptySetlist = { ...setlist, sets: { set: [] } }
    render(<SetlistResults setlists={[emptySetlist]} />)
    expect(screen.queryByRole('button', { name: /Ver setlist/ })).not.toBeInTheDocument()
  })

  it('adds the show and navigates to its detail page, converting the setlist date to ISO', async () => {
    mockAddExternalEvent.mockResolvedValue({ eventId: 'new-event-1' })
    render(<SetlistResults setlists={[setlist]} />)

    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/events/new-event-1')
    })
    expect(mockAddExternalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ datetime: '2024-12-25T00:00:00Z' }),
      'Bandalos Chinos'
    )
  })

  it('shows a per-show error and does not navigate when adding fails', async () => {
    mockAddExternalEvent.mockResolvedValue({ error: 'boom' })
    render(<SetlistResults setlists={[setlist]} />)

    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }))

    await waitFor(() => {
      expect(screen.getByText('boom')).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })
})
