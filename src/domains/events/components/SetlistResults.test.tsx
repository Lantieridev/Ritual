// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockAddExternalEvent = vi.fn()
const mockPush = vi.fn()

vi.mock('urql', async () => {
  const actual = await vi.importActual<typeof import('urql')>('urql')
  return { ...actual, useMutation: () => [{ fetching: false }, mockAddExternalEvent] }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

import { SetlistResults } from '@/src/domains/events/components/SetlistResults'
import { TRANSPORT_ERROR_MESSAGE } from '@/src/graphql/mutation-result'
import { transportError } from '@/src/graphql/transport-failure.testing'
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
    mockAddExternalEvent.mockResolvedValue({
      data: { addExternalEvent: { eventId: 'new-event-1' } },
    })
    render(<SetlistResults setlists={[setlist]} />)

    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/events/new-event-1')
    })
    // Sin `id` ni `url`: la mutation solo lee lo que necesita para importar.
    expect(mockAddExternalEvent).toHaveBeenCalledWith({
      input: {
        title: 'Bandalos Chinos @ Niceto',
        datetime: '2024-12-25T00:00:00Z',
        venue: { name: 'Niceto', city: 'CABA', country: 'Argentina' },
        lineup: ['Bandalos Chinos'],
      },
      artistNameForLineup: 'Bandalos Chinos',
      notes: '1. Cumbia Rara\n2. Ela',
    })
  })

  it('passes undefined notes when the setlist has no songs, instead of an empty string', async () => {
    mockAddExternalEvent.mockResolvedValue({
      data: { addExternalEvent: { eventId: 'new-event-1' } },
    })
    const emptySetlist = { ...setlist, sets: { set: [] } }
    render(<SetlistResults setlists={[emptySetlist]} />)

    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }))

    await waitFor(() => {
      expect(mockAddExternalEvent).toHaveBeenCalledWith(
        expect.objectContaining({ notes: undefined })
      )
    })
  })

  it('shows a per-show error and does not navigate when adding fails', async () => {
    mockAddExternalEvent.mockResolvedValue({ data: { addExternalEvent: { error: 'boom' } } })
    render(<SetlistResults setlists={[setlist]} />)

    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }))

    await waitFor(() => {
      expect(screen.getByText('boom')).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  // Sin unwrapMutation, `data` undefined se leía como éxito: el botón quedaba
  // en "Guardado" por un show que nunca se creó.
  it('reports an error and stays addable when the request never reaches the resolver', async () => {
    mockAddExternalEvent.mockResolvedValue({ data: undefined, error: transportError() })
    render(<SetlistResults setlists={[setlist]} />)

    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }))

    await waitFor(() => {
      expect(screen.getByText(TRANSPORT_ERROR_MESSAGE)).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Guardar/ })).toBeEnabled()
  })
})
