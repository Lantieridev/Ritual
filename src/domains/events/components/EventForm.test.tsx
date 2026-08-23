// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Venue, Artist, EventWithRelations } from '@/src/core/types'
import { TRANSPORT_ERROR_MESSAGE } from '@/src/graphql/mutation-result'
import { transportError } from '@/src/graphql/transport-failure.testing'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

// El form ya no recibe ninguna escritura por prop: todas salen por urql, así
// que los dobles se enganchan en useMutation y se enrutan por el nombre de la
// operación.
const findOrCreateVenueMock = vi.fn()
const findOrCreateArtistMock = vi.fn()
const createEventMock = vi.fn()
const updateEventMock = vi.fn()
const setAttendanceStatusMock = vi.fn()
const saveMemoryMock = vi.fn()
const createExpenseMock = vi.fn()

const mutationsByName: Record<string, ReturnType<typeof vi.fn>> = {
  FindOrCreateVenue: findOrCreateVenueMock,
  FindOrCreateArtist: findOrCreateArtistMock,
  CreateEvent: createEventMock,
  UpdateEvent: updateEventMock,
  SetAttendanceStatus: setAttendanceStatusMock,
  SaveMemory: saveMemoryMock,
  CreateExpense: createExpenseMock,
}

vi.mock('urql', async () => {
  const actual = await vi.importActual<typeof import('urql')>('urql')
  return {
    ...actual,
    useMutation: (doc: { definitions?: Array<{ name?: { value?: string } }> }) => {
      const name = doc.definitions?.[0]?.name?.value ?? ''
      return [{ fetching: false }, mutationsByName[name]]
    },
  }
})

import { EventForm } from '@/src/domains/events/components/EventForm'

const venues = [{ id: 'v1', name: 'Niceto', city: 'CABA' }] as Venue[]
const artists = [
  { id: 'a1', name: 'Bandalos Chinos', genre: 'Indie' },
  { id: 'a2', name: 'Usted Señalemelo', genre: 'Rock' },
] as Artist[]

function resetMutations() {
  push.mockClear()
  Object.values(mutationsByName).forEach((mock) => mock.mockReset())
  createEventMock.mockResolvedValue({ data: { createEvent: { id: 'e-new' } } })
  updateEventMock.mockResolvedValue({ data: { updateEvent: { error: null } } })
  setAttendanceStatusMock.mockResolvedValue({ data: { setAttendanceStatus: { error: null } } })
  saveMemoryMock.mockResolvedValue({ data: { saveMemory: { error: null } } })
  createExpenseMock.mockResolvedValue({ data: { createExpense: { id: 'x1' } } })
}

async function pickVenue(name: string) {
  await userEvent.type(screen.getByLabelText(/Sede/), name)
  await userEvent.click(await screen.findByRole('option', { name: new RegExp(name) }))
}

async function pickArtist(name: string) {
  await userEvent.type(screen.getByLabelText(/Artistas en el lineup/), name)
  await userEvent.click(await screen.findByRole('option', { name: new RegExp(name) }))
}

describe('EventForm — create mode', () => {
  beforeEach(resetMutations)

  it('submits name, date, venue, and selected lineup artists, then navigates to the new event', async () => {
    render(<EventForm venues={venues} artists={artists} />)

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show en Niceto')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await pickVenue('Niceto')
    await pickArtist('Bandalos Chinos')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y generar el talón' }))

    await waitFor(() => {
      expect(createEventMock).toHaveBeenCalledWith({
        input: {
          name: 'Show en Niceto',
          // Fecha + hora combinadas en un timestamp con el offset fijo de
          // Argentina (-03:00) — "20:00" es el default del input de hora, no
          // se tocó en este test (issue #8).
          date: '2024-05-01T20:00:00-03:00',
          venueId: 'v1',
          artistIds: ['a1'],
          ticketUrl: '',
        },
      })
    })
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/events/e-new')
    })
  })

  it('combines the chosen date and time into the timestamp sent to createEvent', async () => {
    render(<EventForm venues={venues} artists={artists} />)

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await userEvent.clear(screen.getByLabelText(/Hora/))
    await userEvent.type(screen.getByLabelText(/Hora/), '23:15')
    await pickVenue('Niceto')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y generar el talón' }))

    await waitFor(() => {
      expect(createEventMock).toHaveBeenCalledWith({
        input: expect.objectContaining({ date: '2024-05-01T23:15:00-03:00' }),
      })
    })
  })

  it('defaults the time input to 20:00 for a new event', () => {
    render(<EventForm venues={venues} artists={artists} />)

    expect(screen.getByLabelText(/Hora/)).toHaveValue('20:00')
  })

  it('removes an artist chip when its "x" is clicked', async () => {
    render(<EventForm venues={venues} artists={artists} />)

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await pickVenue('Niceto')
    await pickArtist('Bandalos Chinos')

    expect(screen.getByText('Bandalos Chinos')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Quitar Bandalos Chinos/ }))
    expect(screen.queryByText('Bandalos Chinos')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Guardar y generar el talón' }))

    await waitFor(() => {
      expect(createEventMock).toHaveBeenCalledWith({
        input: expect.objectContaining({ artistIds: [] }),
      })
    })
  })

  it('creates a new venue inline via the combobox and uses its id', async () => {
    findOrCreateVenueMock.mockResolvedValue({ data: { findOrCreateVenue: { id: 'v-new' } } })
    render(<EventForm venues={[]} artists={artists} />)

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await userEvent.type(screen.getByLabelText(/Sede/), 'Movistar Arena')
    await userEvent.click(await screen.findByRole('option', { name: /Crear "Movistar Arena"/ }))

    expect(findOrCreateVenueMock).toHaveBeenCalledWith({ name: 'Movistar Arena' })
    expect(await screen.findByText('Movistar Arena')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Guardar y generar el talón' }))

    await waitFor(() => {
      expect(createEventMock).toHaveBeenCalledWith({
        input: expect.objectContaining({ venueId: 'v-new' }),
      })
    })
  })

  it('shows the error from the inline venue creation without crashing', async () => {
    findOrCreateVenueMock.mockResolvedValue({
      data: { findOrCreateVenue: { error: 'Ya existe una sede con ese nombre.' } },
    })
    render(<EventForm venues={venues} artists={artists} />)

    await userEvent.type(screen.getByLabelText(/Sede/), 'Niceto Duplicado')
    await userEvent.click(await screen.findByRole('option', { name: /Crear "Niceto Duplicado"/ }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Ya existe una sede con ese nombre.')
    })
  })

  it('requires a venue to be selected before submitting', async () => {
    render(<EventForm venues={venues} artists={artists} />)

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y generar el talón' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Debes elegir una sede.')
    expect(createEventMock).not.toHaveBeenCalled()
  })

  it('shows the error and re-enables the form when creation fails', async () => {
    createEventMock.mockResolvedValue({
      data: { createEvent: { error: 'Ya existe un recital con ese nombre.' } },
    })
    render(<EventForm venues={venues} artists={artists} />)

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
    render(<EventForm venues={venues} artists={artists} />)

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await pickVenue('Niceto')
    await userEvent.click(screen.getByRole('button', { name: '5 estrellas' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y generar el talón' }))

    await waitFor(() => {
      expect(setAttendanceStatusMock).toHaveBeenCalledWith({ eventId: 'e-new', status: 'went' })
      expect(saveMemoryMock).toHaveBeenCalledWith({
        eventId: 'e-new',
        rating: 5,
        review: undefined,
      })
    })
  })

  // El gasto es un dato de nivel "día": va con la fecha sola, no con el
  // timestamp que combina fecha y hora del show.
  it('chains the expense on the plain date when an amount was entered', async () => {
    render(<EventForm venues={venues} artists={artists} />)

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await pickVenue('Niceto')
    await userEvent.type(screen.getByLabelText(/Gasto de la noche/), '15000')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y generar el talón' }))

    await waitFor(() => {
      expect(createExpenseMock).toHaveBeenCalledWith({
        input: expect.objectContaining({ amount: 15000, eventId: 'e-new', date: '2024-05-01' }),
      })
    })
  })

  // AllAccess/Passline no tienen API de búsqueda — issue #19 lo resuelve con
  // un link manual por evento en vez de una integración inventada.
  it('includes the ticket link when filled', async () => {
    render(<EventForm venues={venues} artists={artists} />)

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await pickVenue('Niceto')
    await userEvent.type(screen.getByLabelText(/Link de entradas/), 'https://www.allaccess.com.ar/event/show')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y generar el talón' }))

    await waitFor(() => {
      expect(createEventMock).toHaveBeenCalledWith({
        input: expect.objectContaining({ ticketUrl: 'https://www.allaccess.com.ar/event/show' }),
      })
    })
  })

  it('does not touch attendance/memory when no rating was set', async () => {
    render(<EventForm venues={venues} artists={artists} />)

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await pickVenue('Niceto')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y generar el talón' }))

    await waitFor(() => {
      expect(push).toHaveBeenCalled()
    })
    expect(setAttendanceStatusMock).not.toHaveBeenCalled()
    expect(saveMemoryMock).not.toHaveBeenCalled()
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

  beforeEach(resetMutations)

  it('pre-fills the selected venue and the artists already in the lineup', () => {
    render(<EventForm venues={venues} artists={artists} event={event} />)

    expect(screen.getByText('Niceto')).toBeInTheDocument()
    expect(screen.getByText('Bandalos Chinos')).toBeInTheDocument()
    expect(screen.queryByText('Usted Señalemelo')).not.toBeInTheDocument()
  })

  it('does not render the rating/review/expense fields — those are only for the create flow', () => {
    render(<EventForm venues={venues} artists={artists} event={event} />)

    expect(screen.queryByLabelText(/¿Ya fuiste\?/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Gasto de la noche/)).not.toBeInTheDocument()
  })

  it('calls updateEvent with the event id on submit, then navigates to its detail page', async () => {
    render(<EventForm venues={venues} artists={artists} event={event} />)

    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(updateEventMock).toHaveBeenCalledWith({
        id: 'e1',
        input: expect.objectContaining({
          name: 'Show existente',
          artistIds: ['a1'],
          // La hora precargada (20:00 ART, ver fixture) se reenvía tal cual
          // si el usuario no la tocó.
          date: '2024-05-01T20:00:00-03:00',
        }),
      })
    })
    await waitFor(() => expect(push).toHaveBeenCalledWith('/events/e1'))
  })

  it('shows the error and stays on the form when the update fails', async () => {
    updateEventMock.mockResolvedValue({
      data: { updateEvent: { error: 'No se pudo guardar.' } },
    })
    render(<EventForm venues={venues} artists={artists} event={event} />)

    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar.')
    })
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
  })

  it('pre-fills the time input from the stored event timestamp, in Argentina local time', () => {
    render(<EventForm venues={venues} artists={artists} event={event} />)

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
      />
    )

    expect(screen.getByLabelText(/Link de entradas/)).toHaveValue('https://www.passline.com/eventos/show')
  })

  it('links "Cancelar" to the event detail page', () => {
    render(<EventForm venues={venues} artists={artists} event={event} />)
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/events/e1')
  })
})

/**
 * Las escrituras fallaban en silencio cuando la mutation no llegaba al
 * resolver: urql resuelve con `data: undefined`, así que cualquier chequeo que
 * solo mire `data.<campo>.error` lee la falla como éxito.
 */
describe('EventForm — transport failures', () => {
  beforeEach(resetMutations)

  it('does not add the venue and surfaces an error when the request never reaches the resolver', async () => {
    findOrCreateVenueMock.mockResolvedValue({ data: undefined, error: transportError() })
    render(<EventForm venues={[]} artists={artists} />)

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await userEvent.type(screen.getByLabelText(/Sede/), 'Movistar Arena')
    await userEvent.click(await screen.findByRole('option', { name: /Crear "Movistar Arena"/ }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(TRANSPORT_ERROR_MESSAGE)
    })

    await userEvent.click(screen.getByRole('button', { name: 'Guardar y generar el talón' }))
    expect(createEventMock).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('does not add the artist to the lineup and surfaces an error when the request never reaches the resolver', async () => {
    findOrCreateArtistMock.mockResolvedValue({ data: undefined, error: transportError() })
    render(<EventForm venues={venues} artists={artists} />)

    await userEvent.type(screen.getByLabelText(/Artistas en el lineup/), 'El Mató')
    await userEvent.click(await screen.findByRole('option', { name: /Crear "El Mató"/ }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(TRANSPORT_ERROR_MESSAGE)
    })
    expect(screen.queryByRole('button', { name: /Quitar El Mató/ })).not.toBeInTheDocument()
  })

  it('does not navigate to a show that was never created when createEvent never reaches the resolver', async () => {
    createEventMock.mockResolvedValue({ data: undefined, error: transportError() })
    render(<EventForm venues={venues} artists={artists} />)

    await userEvent.type(screen.getByLabelText(/Nombre del recital/), 'Show')
    await userEvent.type(screen.getByLabelText(/Fecha/), '2024-05-01')
    await pickVenue('Niceto')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y generar el talón' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(TRANSPORT_ERROR_MESSAGE)
    })
    expect(push).not.toHaveBeenCalled()
    expect(setAttendanceStatusMock).not.toHaveBeenCalled()
  })

  it('does not navigate away from unsaved edits when updateEvent never reaches the resolver', async () => {
    updateEventMock.mockResolvedValue({ data: undefined, error: transportError() })
    render(
      <EventForm
        venues={venues}
        artists={artists}
        event={
          {
            id: 'e1',
            name: 'Show existente',
            date: '2024-05-01T23:00:00Z',
            venue_id: 'v1',
            lineups: [],
          } as unknown as EventWithRelations
        }
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(TRANSPORT_ERROR_MESSAGE)
    })
    expect(push).not.toHaveBeenCalled()
  })
})
