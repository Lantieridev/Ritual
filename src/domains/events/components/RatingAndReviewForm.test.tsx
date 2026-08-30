// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockSaveMemory = vi.fn()

vi.mock('@/src/domains/events/attendance-actions', () => ({
  saveMemory: (...args: unknown[]) => mockSaveMemory(...args),
}))

import { RatingAndReviewForm } from '@/src/domains/events/components/RatingAndReviewForm'

describe('RatingAndReviewForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSaveMemory.mockResolvedValue({})
  })

  it('pre-fills the review/notes from the initial values', () => {
    render(
      <RatingAndReviewForm
        eventId="e1"
        initialRating={4}
        initialReview="Buenísimo"
        initialNotes="Tocaron 20 temas"
      />
    )
    expect(screen.getByLabelText('Reseña')).toHaveValue('Buenísimo')
    expect(screen.getByLabelText('Notas / Setlist')).toHaveValue('Tocaron 20 temas')
  })

  it('sets the rating when a star is clicked', async () => {
    render(<RatingAndReviewForm eventId="e1" />)

    await userEvent.click(screen.getByRole('button', { name: '3 estrellas' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar memoria' }))

    await waitFor(() => {
      expect(mockSaveMemory).toHaveBeenCalledWith('e1', { rating: 3, review: undefined, notes: undefined })
    })
  })

  it('clears the rating via the "Borrar" button', async () => {
    render(<RatingAndReviewForm eventId="e1" initialRating={5} />)

    expect(screen.getByRole('button', { name: 'Borrar' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Borrar' }))

    expect(screen.queryByRole('button', { name: 'Borrar' })).not.toBeInTheDocument()
  })

  it('trims review/notes and omits them entirely when empty', async () => {
    render(<RatingAndReviewForm eventId="e1" />)

    await userEvent.type(screen.getByLabelText('Reseña'), '  Buen show  ')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar memoria' }))

    await waitFor(() => {
      expect(mockSaveMemory).toHaveBeenCalledWith('e1', {
        rating: undefined,
        review: 'Buen show',
        notes: undefined,
      })
    })
  })

  it('shows "✓ Guardado" after a successful save', async () => {
    render(<RatingAndReviewForm eventId="e1" />)

    await userEvent.click(screen.getByRole('button', { name: 'Guardar memoria' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Guardado/ })).toBeInTheDocument()
    })
  })

  it('shows the error message when saving fails', async () => {
    mockSaveMemory.mockResolvedValue({ error: 'No se pudo guardar' })
    render(<RatingAndReviewForm eventId="e1" />)

    await userEvent.click(screen.getByRole('button', { name: 'Guardar memoria' }))

    await waitFor(() => {
      expect(screen.getByText('No se pudo guardar')).toBeInTheDocument()
    })
  })

  // Issue #62: reducción de daños.
  it('sends usedEarProtection true when "Sí" is picked', async () => {
    render(<RatingAndReviewForm eventId="e1" />)

    await userEvent.click(screen.getByRole('button', { name: 'Sí' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar memoria' }))

    await waitFor(() => {
      expect(mockSaveMemory).toHaveBeenCalledWith('e1', expect.objectContaining({ usedEarProtection: true }))
    })
  })

  it('sends usedEarProtection false when "No" is picked', async () => {
    render(<RatingAndReviewForm eventId="e1" />)

    await userEvent.click(screen.getByRole('button', { name: 'No' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar memoria' }))

    await waitFor(() => {
      expect(mockSaveMemory).toHaveBeenCalledWith('e1', expect.objectContaining({ usedEarProtection: false }))
    })
  })

  it('omits usedEarProtection entirely when the question was never answered — optional, does not block anything', async () => {
    render(<RatingAndReviewForm eventId="e1" />)

    await userEvent.click(screen.getByRole('button', { name: 'Guardar memoria' }))

    await waitFor(() => {
      expect(mockSaveMemory).toHaveBeenCalledWith('e1', expect.not.objectContaining({ usedEarProtection: expect.anything() }))
    })
  })

  it('clicking "Sí" again toggles the answer back to unanswered', async () => {
    render(<RatingAndReviewForm eventId="e1" />)

    const yesButton = screen.getByRole('button', { name: 'Sí' })
    await userEvent.click(yesButton)
    expect(yesButton).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(yesButton)
    expect(yesButton).toHaveAttribute('aria-pressed', 'false')
  })

  it('pre-fills the answer from initialUsedEarProtection', () => {
    render(<RatingAndReviewForm eventId="e1" initialUsedEarProtection={true} />)

    expect(screen.getByRole('button', { name: 'Sí' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'No' })).toHaveAttribute('aria-pressed', 'false')
  })

  // Issue #28: zona/sector.
  it('pre-fills and sends the zone', async () => {
    render(<RatingAndReviewForm eventId="e1" initialZone="Campo General" />)

    expect(screen.getByLabelText('Zona / sector')).toHaveValue('Campo General')

    await userEvent.click(screen.getByRole('button', { name: 'Guardar memoria' }))

    await waitFor(() => {
      expect(mockSaveMemory).toHaveBeenCalledWith('e1', expect.objectContaining({ zone: 'Campo General' }))
    })
  })

  it('omits zone entirely when left blank', async () => {
    render(<RatingAndReviewForm eventId="e1" />)

    await userEvent.click(screen.getByRole('button', { name: 'Guardar memoria' }))

    await waitFor(() => {
      expect(mockSaveMemory).toHaveBeenCalledWith('e1', expect.not.objectContaining({ zone: expect.anything() }))
    })
  })
})
