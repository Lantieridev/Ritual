// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventForm } from '@/src/domains/events/components/EventForm'
import type { Venue, Artist, EventWithRelations } from '@/src/core/types'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

// Las altas inline de sede/artista dejaron de llegar por prop: el form
// dispara las mutations directo, asi que el doble se engancha en useMutation
// y se enruta por el nombre de la operacion.
const findOrCreateVenueMock = vi.fn()
const findOrCreateArtistMock = vi.fn()

vi.mock('urql', async () => {
  const actual = await vi.importActual<typeof import('urql')>('urql')
  return {
    ...actual,
    useMutation: (doc: { definitions?: Array<{ name?: { value?: string } }> }) =>
      doc.definitions?.[0]?.name?.value === 'FindOrCreateVenue'
        ? [{ fetching: false }, findOrCreateVenueMock]
        : [{ fetching: false }, findOrCreateArtistMock],
  }
})

const venues = [{ id: 'v1', name: 'Niceto', city: 'CABA' }] as Venue[]
const artists = [
  { id: 'a1', name: 'Bandalos Chinos', genre: 'Indie' },
  { id: 'a2', name: 'Usted Señalemelo', genre: 'Rock' },
] as Artist[]

async function pickVenue(name: string) {
  await userEvent.type(screen.getByLabelText(/Sede/), name)
  await userEvent.click(await screen.findByRole('option', { name: new RegExp(name) }))
}

async function pickArtist(name: string) {
  await userEvent.type(screen.getByLabelText(/Artistas en el lineup/), name)
  await userEvent.click(await screen.findByRole('option', { name: new RegExp(name) }))
}

describe('EventForm — create mode', () => {
  beforeEach(() => {
    push.mockClear()
    findOrCreateVenueMock.mockReset()
    findOrCreateArtistMock.mockReset()
  })

  it('submits name, date, venue, and selected lineup artists, then navigates to the new event', async () => {
    const insertEvent = vi.fn().mockResolvedValue({ id: 'e-new' })
    render(
      <EventForm
        venues={venues}
        artists={artists}
        insertEvent={insertEvent}
      />
    )

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show en Niceto')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await pickVenue('Niceto')
    await pickArtist('Bandalos Chinos')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y generar el talón' }))

    await waitFor(() => {
      expect(insertEvent).toHaveBeenCalledWith({
        name: 'Show en Niceto',
        // Fecha + hora combinadas en un timestamp con el offset fijo de
        // Argentina (-03:00) — "20:00" es el default del input de hora, no
        // se tocó en este test (issue #8).
        date: '2024-05-01T20:00:00-03:00',
        venue_id: 'v1',
        artist_ids: ['a1'],
        ticket_url: '',
      })
    })
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/events/e-new')
    })
  })

  it('combines the chosen date and time into the timestamp sent to insertEvent', async () => {
    const insertEvent = vi.fn().mockResolvedValue({ id: 'e-new' })
    render(
      <EventForm
        venues={venues}
        artists={artists}
        insertEvent={insertEvent}
      />
    )

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await userEvent.clear(screen.getByLabelText(/Hora/))
    await userEvent.type(screen.getByLabelText(/Hora/), '23:15')
    await pickVenue('Niceto')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y generar el talón' }))

    await waitFor(() => {
      expect(insertEvent).toHaveBeenCalledWith(
        expect.objectContaining({ date: '2024-05-01T23:15:00-03:00' })
      )
    })
  })

  it('defaults the time input to 20:00 for a new event', () => {
    render(
      <EventForm
        venues={venues}
        artists={artists}
        insertEvent={vi.fn()}
      />
    )

    expect(screen.getByLabelText(/Hora/)).toHaveValue('20:00')
  })

  it('removes an artist chip when its "x" is clicked', async () => {
    const insertEvent = vi.fn().mockResolvedValue({ id: 'e-new' })
    render(
      <EventForm
        venues={venues}
        artists={artists}
        insertEvent={insertEvent}
      />
    )

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await pickVenue('Niceto')
    await pickArtist('Bandalos Chinos')

    expect(screen.getByText('Bandalos Chinos')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Quitar Bandalos Chinos/ }))
    expect(screen.queryByText('Bandalos Chinos')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Guardar y generar el talón' }))

    await waitFor(() => {
      expect(insertEvent).toHaveBeenCalledWith(expect.objectContaining({ artist_ids: [] }))
    })
  })

  it('creates a new venue inline via the combobox and uses its id', async () => {
    const insertEvent = vi.fn().mockResolvedValue({ id: 'e-new' })
    findOrCreateVenueMock.mockResolvedValue({ data: { findOrCreateVenue: { id: 'v-new' } } })
    render(
      <EventForm
        venues={[]}
        artists={artists}
        insertEvent={insertEvent}
      />
    )

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await userEvent.type(screen.getByLabelText(/Sede/), 'Movistar Arena')
    await userEvent.click(await screen.findByRole('option', { name: /Crear "Movistar Arena"/ }))

    expect(findOrCreateVenueMock).toHaveBeenCalledWith({ name: 'Movistar Arena' })
    expect(await screen.findByText('Movistar Arena')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Guardar y generar el talón' }))

    await waitFor(() => {
      expect(insertEvent).toHaveBeenCalledWith(expect.objectContaining({ venue_id: 'v-new' }))
    })
  })

  it('shows the error from the inline venue creation without crashing', async () => {
    findOrCreateVenueMock.mockResolvedValue({
      data: { findOrCreateVenue: { error: 'Ya existe una sede con ese nombre.' } },
    })
    render(
      <EventForm
        venues={venues}
        artists={artists}
        insertEvent={vi.fn()}
      />
    )

    await userEvent.type(screen.getByLabelText(/Sede/), 'Niceto Duplicado')
    await userEvent.click(await screen.findByRole('option', { name: /Crear "Niceto Duplicado"/ }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Ya existe una sede con ese nombre.')
    })
  })

  it('requires a venue to be selected before submitting', async () => {
    const insertEvent = vi.fn()
    render(
      <EventForm
        venues={venues}
        artists={artists}
        insertEvent={insertEvent}
      />
    )

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y generar el talón' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Debes elegir una sede.')
    expect(insertEvent).not.toHaveBeenCalled()
  })

  it('shows the error and re-enables the form when creation fails', async () => {
    const insertEvent = vi.fn().mockResolvedValue({ error: 'Ya existe un recital con ese nombre.' })
    render(
      <EventForm
        venues={venues}
        artists={artists}
        insertEvent={insertEvent}
      />
    )

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await pickVenue('Niceto')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y generar el talón' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Ya existe un recital con ese nombre.')
    })
    expect(screen.getByRole('button', { name: 'Guardar y generar el talón' })).toBeEnabled()
    expect(push).not.toHaveBeenCalled()
  })

  it('chains attendance + memory when a rating was set, before navigating', async () => {
    const insertEvent = vi.fn().mockResolvedValue({ id: 'e-new' })
    const setAttendanceStatus = vi.fn().mockResolvedValue({})
    const saveMemory = vi.fn().mockResolvedValue({})
    render(
      <EventForm
        venues={venues}
        artists={artists}
        insertEvent={insertEvent}
        setAttendanceStatus={setAttendanceStatus}
        saveMemory={saveMemory}
      />
    )

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await pickVenue('Niceto')
    await userEvent.click(screen.getByRole('button', { name: '5 estrellas' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y generar el talón' }))

    await waitFor(() => {
      expect(setAttendanceStatus).toHaveBeenCalledWith('e-new', 'went')
      expect(saveMemory).toHaveBeenCalledWith('e-new', { rating: 5, review: undefined })
    })
  })

  // AllAccess/Passline no tienen API de búsqueda — issue #19 lo resuelve con
  // un link manual por evento en vez de una integración inventada.
  it('includes the ticket link when filled', async () => {
    const insertEvent = vi.fn().mockResolvedValue({ id: 'e-new' })
    render(
      <EventForm
        venues={venues}
        artists={artists}
        insertEvent={insertEvent}
      />
    )

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await pickVenue('Niceto')
    await userEvent.type(screen.getByLabelText(/Link de entradas/), 'https://www.allaccess.com.ar/event/show')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y generar el talón' }))

    await waitFor(() => {
      expect(insertEvent).toHaveBeenCalledWith(
        expect.objectContaining({ ticket_url: 'https://www.allaccess.com.ar/event/show' })
      )
    })
  })

  it('does not touch attendance/memory when no rating was set', async () => {
    const insertEvent = vi.fn().mockResolvedValue({ id: 'e-new' })
    const setAttendanceStatus = vi.fn()
    const saveMemory = vi.fn()
    render(
      <EventForm
        venues={venues}
        artists={artists}
        insertEvent={insertEvent}
        setAttendanceStatus={setAttendanceStatus}
        saveMemory={saveMemory}
      />
    )

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await pickVenue('Niceto')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y generar el talón' }))

    await waitFor(() => {
      expect(push).toHaveBeenCalled()
    })
    expect(setAttendanceStatus).not.toHaveBeenCalled()
    expect(saveMemory).not.toHaveBeenCalled()
  })
})

describe('EventForm — edit mode', () => {
  const event = {
    id: 'e1',
    name: 'Show existente',
    // Timestamp completo (como lo devuelve Supabase siempre, sea el evento
    // manual o importado) — 23:00 UTC = 20:00 ART.
    date: '2024-05-01T23:00:00Z',
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
      />
    )

    expect(screen.getByText('Niceto')).toBeInTheDocument()
    expect(screen.getByText('Bandalos Chinos')).toBeInTheDocument()
    expect(screen.queryByText('Usted Señalemelo')).not.toBeInTheDocument()
  })

  it('does not render the rating/review/expense fields — those are only for the create flow', () => {
    render(
      <EventForm
        venues={venues}
        artists={artists}
        event={event}
        updateEvent={vi.fn()}
      />
    )

    expect(screen.queryByLabelText(/¿Ya fuiste\?/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Gasto de la noche/)).not.toBeInTheDocument()
  })

  it('calls updateEvent with the event id on submit', async () => {
    const updateEvent = vi.fn().mockResolvedValue({})
    render(
      <EventForm
        venues={venues}
        artists={artists}
        event={event}
        updateEvent={updateEvent}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(updateEvent).toHaveBeenCalledWith(
        'e1',
        expect.objectContaining({
          name: 'Show existente',
          artist_ids: ['a1'],
          // La hora precargada (20:00 ART, ver fixture) se reenvía tal cual
          // si el usuario no la tocó.
          date: '2024-05-01T20:00:00-03:00',
        })
      )
    })
  })

  it('pre-fills the time input from the stored event timestamp, in Argentina local time', () => {
    render(
      <EventForm
        venues={venues}
        artists={artists}
        event={event}
        updateEvent={vi.fn()}
      />
    )

    // event.date es '2024-05-01T23:00:00Z' = 20:00 ART.
    expect(screen.getByLabelText(/Hora/)).toHaveValue('20:00')
  })

  // AllAccess/Passline no tienen API de búsqueda — issue #19 lo resuelve con
  // un link manual por evento en vez de una integración inventada.
  it('pre-fills the ticket link when the event already has one', () => {
    render(
      <EventForm
        venues={venues}
        artists={artists}
        event={{ ...event, ticket_url: 'https://www.passline.com/eventos/show' }}
        updateEvent={vi.fn()}
      />
    )

    expect(screen.getByLabelText(/Link de entradas/)).toHaveValue('https://www.passline.com/eventos/show')
  })

  it('links "Cancelar" to the event detail page', () => {
    render(
      <EventForm
        venues={venues}
        artists={artists}
        event={event}
        updateEvent={vi.fn()}
      />
    )
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/events/e1')
  })
})
