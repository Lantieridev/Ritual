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

const noopFindOrCreateVenue = vi.fn()
const noopFindOrCreateArtist = vi.fn()

async function pickVenue(name: string) {
  await userEvent.type(screen.getByLabelText(/Sede/), name)
  await userEvent.click(await screen.findByRole('option', { name: new RegExp(name) }))
}

async function pickArtist(name: string) {
  await userEvent.type(screen.getByLabelText(/Artistas en el lineup/), name)
  await userEvent.click(await screen.findByRole('option', { name: new RegExp(name) }))
}

describe('EventForm — create mode', () => {
  it('submits name, date, venue, and selected lineup artists', async () => {
    const createEvent = vi.fn().mockResolvedValue({})
    render(
      <EventForm
        venues={venues}
        artists={artists}
        createEvent={createEvent}
        findOrCreateVenue={noopFindOrCreateVenue}
        findOrCreateArtist={noopFindOrCreateArtist}
      />
    )

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show en Niceto')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await pickVenue('Niceto')
    await pickArtist('Bandalos Chinos')
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

  it('removes an artist chip when its "x" is clicked', async () => {
    const createEvent = vi.fn().mockResolvedValue({})
    render(
      <EventForm
        venues={venues}
        artists={artists}
        createEvent={createEvent}
        findOrCreateVenue={noopFindOrCreateVenue}
        findOrCreateArtist={noopFindOrCreateArtist}
      />
    )

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await pickVenue('Niceto')
    await pickArtist('Bandalos Chinos')

    expect(screen.getByText('Bandalos Chinos')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Quitar Bandalos Chinos/ }))
    expect(screen.queryByText('Bandalos Chinos')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Crear recital' }))

    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ artist_ids: [] }))
    })
  })

  it('creates a new venue inline via the combobox and uses its id', async () => {
    const createEvent = vi.fn().mockResolvedValue({})
    const findOrCreateVenue = vi.fn().mockResolvedValue({ id: 'v-new' })
    render(
      <EventForm
        venues={[]}
        artists={artists}
        createEvent={createEvent}
        findOrCreateVenue={findOrCreateVenue}
        findOrCreateArtist={noopFindOrCreateArtist}
      />
    )

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await userEvent.type(screen.getByLabelText(/Sede/), 'Movistar Arena')
    await userEvent.click(await screen.findByRole('option', { name: /Crear "Movistar Arena"/ }))

    expect(findOrCreateVenue).toHaveBeenCalledWith('Movistar Arena')
    expect(await screen.findByText('Movistar Arena')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Crear recital' }))

    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ venue_id: 'v-new' }))
    })
  })

  it('shows the error from the inline venue creation without crashing', async () => {
    const findOrCreateVenue = vi.fn().mockResolvedValue({ error: 'Ya existe una sede con ese nombre.' })
    render(
      <EventForm
        venues={venues}
        artists={artists}
        createEvent={vi.fn()}
        findOrCreateVenue={findOrCreateVenue}
        findOrCreateArtist={noopFindOrCreateArtist}
      />
    )

    await userEvent.type(screen.getByLabelText(/Sede/), 'Niceto Duplicado')
    await userEvent.click(await screen.findByRole('option', { name: /Crear "Niceto Duplicado"/ }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Ya existe una sede con ese nombre.')
    })
  })

  it('requires a venue to be selected before submitting', async () => {
    const createEvent = vi.fn()
    render(
      <EventForm
        venues={venues}
        artists={artists}
        createEvent={createEvent}
        findOrCreateVenue={noopFindOrCreateVenue}
        findOrCreateArtist={noopFindOrCreateArtist}
      />
    )

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await userEvent.click(screen.getByRole('button', { name: 'Crear recital' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Debes elegir una sede.')
    expect(createEvent).not.toHaveBeenCalled()
  })

  it('shows the error and re-enables the form when creation fails', async () => {
    const createEvent = vi.fn().mockResolvedValue({ error: 'Ya existe un recital con ese nombre.' })
    render(
      <EventForm
        venues={venues}
        artists={artists}
        createEvent={createEvent}
        findOrCreateVenue={noopFindOrCreateVenue}
        findOrCreateArtist={noopFindOrCreateArtist}
      />
    )

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await pickVenue('Niceto')
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
    lineups: [{ artists: { id: 'a1', name: 'Bandalos Chinos', genre: 'Indie' } }],
  } as EventWithRelations

  it('pre-fills the selected venue and the artists already in the lineup', () => {
    render(
      <EventForm
        venues={venues}
        artists={artists}
        event={event}
        updateEvent={vi.fn()}
        findOrCreateVenue={noopFindOrCreateVenue}
        findOrCreateArtist={noopFindOrCreateArtist}
      />
    )

    expect(screen.getByText('Niceto')).toBeInTheDocument()
    expect(screen.getByText('Bandalos Chinos')).toBeInTheDocument()
    expect(screen.queryByText('Usted Señalemelo')).not.toBeInTheDocument()
  })

  it('calls updateEvent with the event id on submit', async () => {
    const updateEvent = vi.fn().mockResolvedValue({})
    render(
      <EventForm
        venues={venues}
        artists={artists}
        event={event}
        updateEvent={updateEvent}
        findOrCreateVenue={noopFindOrCreateVenue}
        findOrCreateArtist={noopFindOrCreateArtist}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(updateEvent).toHaveBeenCalledWith(
        'e1',
        expect.objectContaining({ name: 'Show existente', artist_ids: ['a1'] })
      )
    })
  })

  it('links "Cancelar" to the event detail page', () => {
    render(
      <EventForm
        venues={venues}
        artists={artists}
        event={event}
        updateEvent={vi.fn()}
        findOrCreateVenue={noopFindOrCreateVenue}
        findOrCreateArtist={noopFindOrCreateArtist}
      />
    )
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/events/e1')
  })
})
