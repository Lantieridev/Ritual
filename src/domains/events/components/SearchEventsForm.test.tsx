// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}))

import { SearchEventsForm } from '@/src/domains/events/components/SearchEventsForm'

describe('SearchEventsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when not configured', () => {
    const { container } = render(<SearchEventsForm configured={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('pre-fills the artist input from initialArtist', () => {
    render(<SearchEventsForm configured={true} initialArtist="Radiohead" />)
    expect(screen.getByLabelText(/Nombre del artista/)).toHaveValue('Radiohead')
  })

  it('navigates to /buscar with the artist and source params on submit', async () => {
    render(<SearchEventsForm configured={true} source="past" />)

    await userEvent.type(screen.getByLabelText(/Nombre del artista/), 'Radiohead')
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(mockPush).toHaveBeenCalledWith('/buscar?source=past&artist=Radiohead')
  })

  it('omits the artist param when the field is left blank', async () => {
    render(<SearchEventsForm configured={true} />)

    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(mockPush).toHaveBeenCalledWith('/buscar?source=future')
  })

  it('hides the artist/location tabs when showLocationTab is false', () => {
    render(<SearchEventsForm configured={true} showLocationTab={false} />)
    expect(screen.queryByRole('button', { name: 'Por ciudad' })).not.toBeInTheDocument()
  })

  it('switches to a location input and searches by city when the location tab is enabled', async () => {
    render(<SearchEventsForm configured={true} showLocationTab={true} source="future" />)

    await userEvent.click(screen.getByRole('button', { name: 'Por ciudad' }))
    await userEvent.type(screen.getByLabelText(/Ciudad o ubicación/), 'Buenos Aires')
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(mockPush).toHaveBeenCalledWith('/buscar?source=future&location=Buenos+Aires')
  })

  it('never offers the location tab for past-source search (Setlist.fm has no city search)', () => {
    render(<SearchEventsForm configured={true} showLocationTab={true} source="past" />)
    expect(screen.queryByRole('button', { name: 'Por ciudad' })).not.toBeInTheDocument()
  })
})
