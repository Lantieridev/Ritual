// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventForm } from '@/src/domains/events/components/EventForm'
import type { Venue, Artist, EventWithRelations } from '@/src/core/types'

const venues = [{ id: 'v1', name: 'Niceto', city: 'CABA' }] as Venue[]
const artists = [
  { id: 'a1', name: 'Bandalos Chinos', genre: 'Indie' },
  { id: 'a2', name: 'Usted Señalemelo', genre: 'Rock' },
] as Artist[]

describe('EventForm — create mode', () => {
  it('submits name, date, venue, and selected lineup artists', async () => {
    const createEvent = vi.fn().mockResolvedValue({})
    render(<EventForm venues={venues} artists={artists} createEvent={createEvent} />)

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show en Niceto')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await userEvent.selectOptions(screen.getByLabelText(/Sede/), 'v1')
    await userEvent.click(screen.getByLabelText(/Bandalos Chinos/))
    await userEvent.click(screen.getByRole('button', { name: 'Crear recital' }))

    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledWith({
        name: 'Show en Niceto',
        date: '2024-05-01',
        venue_id: 'v1',
        artist_ids: ['a1'],
      })
    })
  })

  it('toggles an artist off when clicked twice', async () => {
    const createEvent = vi.fn().mockResolvedValue({})
    render(<EventForm venues={venues} artists={artists} createEvent={createEvent} />)

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await userEvent.selectOptions(screen.getByLabelText(/Sede/), 'v1')

    const checkbox = screen.getByLabelText(/Bandalos Chinos/)
    await userEvent.click(checkbox)
    await userEvent.click(checkbox)
    await userEvent.click(screen.getByRole('button', { name: 'Crear recital' }))

    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ artist_ids: [] }))
    })
  })

  it('shows a hint instead of an empty checkbox list when there are no artists', () => {
    render(<EventForm venues={venues} artists={[]} createEvent={vi.fn()} />)
    expect(screen.getByText(/No hay artistas cargados/)).toBeInTheDocument()
  })

  it('shows the error and re-enables the form when creation fails', async () => {
    const createEvent = vi.fn().mockResolvedValue({ error: 'Ya existe un recital con ese nombre.' })
    render(<EventForm venues={venues} artists={artists} createEvent={createEvent} />)

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await userEvent.selectOptions(screen.getByLabelText(/Sede/), 'v1')
    await userEvent.click(screen.getByRole('button', { name: 'Crear recital' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Ya existe un recital con ese nombre.')
    })
    expect(screen.getByRole('button', { name: 'Crear recital' })).toBeEnabled()
  })
})

describe('EventForm — edit mode', () => {
  const event = {
    id: 'e1',
    name: 'Show existente',
    date: '2024-05-01',
    venue_id: 'v1',
    lineups: [{ artists: { id: 'a1', name: 'Bandalos Chinos' } }],
  } as EventWithRelations

  it('pre-checks the artists already in the lineup', () => {
    render(<EventForm venues={venues} artists={artists} event={event} updateEvent={vi.fn()} />)

    expect(screen.getByLabelText(/Bandalos Chinos/)).toBeChecked()
    expect(screen.getByLabelText(/Usted Señalemelo/)).not.toBeChecked()
  })

  it('calls updateEvent with the event id on submit', async () => {
    const updateEvent = vi.fn().mockResolvedValue({})
    render(<EventForm venues={venues} artists={artists} event={event} updateEvent={updateEvent} />)

    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(updateEvent).toHaveBeenCalledWith(
        'e1',
        expect.objectContaining({ name: 'Show existente', artist_ids: ['a1'] })
      )
    })
  })

  it('links "Cancelar" to the event detail page', () => {
    render(<EventForm venues={venues} artists={artists} event={event} updateEvent={vi.fn()} />)
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/events/e1')
  })
})
