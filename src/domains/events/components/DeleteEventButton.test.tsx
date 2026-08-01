// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteEventButton } from '@/src/domains/events/components/DeleteEventButton'
import type { EventWithRelations } from '@/src/core/types'

const event = { id: 'e1', name: 'Show de prueba' } as EventWithRelations

describe('DeleteEventButton', () => {
  it('shows only the trigger button before confirming', () => {
    render(<DeleteEventButton event={event} deleteEvent={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Romper este talón' })).toBeInTheDocument()
    expect(screen.queryByText(/Sí, eliminar/)).not.toBeInTheDocument()
  })

  it('shows the confirmation dialog with the event name after the first click', async () => {
    render(<DeleteEventButton event={event} deleteEvent={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Romper este talón' }))

    expect(screen.getByText(/Show de prueba/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sí, eliminar/ })).toBeInTheDocument()
  })

  it('cancels back to the initial state without calling deleteEvent', async () => {
    const deleteEvent = vi.fn()
    render(<DeleteEventButton event={event} deleteEvent={deleteEvent} />)

    await userEvent.click(screen.getByRole('button', { name: 'Romper este talón' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.getByRole('button', { name: 'Romper este talón' })).toBeInTheDocument()
    expect(deleteEvent).not.toHaveBeenCalled()
  })

  it('calls deleteEvent with the event id on confirm', async () => {
    const deleteEvent = vi.fn().mockResolvedValue({})
    render(<DeleteEventButton event={event} deleteEvent={deleteEvent} />)

    await userEvent.click(screen.getByRole('button', { name: 'Romper este talón' }))
    await userEvent.click(screen.getByRole('button', { name: /Sí, eliminar/ }))

    expect(deleteEvent).toHaveBeenCalledWith('e1')
  })

  it('shows the error message and stays in confirming state when the delete fails', async () => {
    const deleteEvent = vi.fn().mockResolvedValue({ error: 'No se pudo eliminar' })
    render(<DeleteEventButton event={event} deleteEvent={deleteEvent} />)

    await userEvent.click(screen.getByRole('button', { name: 'Romper este talón' }))
    await userEvent.click(screen.getByRole('button', { name: /Sí, eliminar/ }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo eliminar')
    })
    expect(screen.getByRole('button', { name: /Sí, eliminar/ })).toBeInTheDocument()
  })

  it('falls back to a generic label when the event has no name', async () => {
    render(<DeleteEventButton event={{ ...event, name: null }} deleteEvent={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Romper este talón' }))

    expect(screen.getByText(/este recital/)).toBeInTheDocument()
  })
})
