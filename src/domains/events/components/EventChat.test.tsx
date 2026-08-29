// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const executeMutation = vi.fn()
const reexecuteQuery = vi.fn()

let queryData: {
  eventMessages: Array<{ id: string; body: string; authorUsername: string | null; createdAt: string; isOwn: boolean }>
} = {
  eventMessages: [],
}
let queryFetching = false

vi.mock('urql', async () => {
  const actual = await vi.importActual<typeof import('urql')>('urql')
  return {
    ...actual,
    useQuery: () => [{ data: queryData, fetching: queryFetching, error: null }, reexecuteQuery],
    useMutation: () => [{ fetching: false }, executeMutation],
  }
})

import { EventChat } from './EventChat'

describe('EventChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryData = { eventMessages: [] }
    queryFetching = false
    executeMutation.mockResolvedValue({ data: { sendEventMessage: { success: true, error: null } } })
  })

  it('renders the message thread returned by useQuery', () => {
    queryData = {
      eventMessages: [
        { id: '1', body: '¿A qué hora nos encontramos en la puerta?', authorUsername: 'carlos', createdAt: '2026-08-29T18:00:00Z', isOwn: false },
        { id: '2', body: 'Yo llego tipo 20hs', authorUsername: 'lucia', createdAt: '2026-08-29T18:05:00Z', isOwn: false },
      ],
    }

    render(<EventChat eventId="evt-123" />)

    expect(screen.getByText('¿A qué hora nos encontramos en la puerta?')).toBeInTheDocument()
    expect(screen.getByText('carlos')).toBeInTheDocument()
    expect(screen.getByText('Yo llego tipo 20hs')).toBeInTheDocument()
    expect(screen.getByText('lucia')).toBeInTheDocument()
  })

  it(
    'distinguishes own message ("Vos", vía isOwn resuelto server-side) de uno ajeno o de ' +
      'autor sin username ("Alguien") — isOwn nunca depende de si hay username cargado',
    () => {
      queryData = {
        eventMessages: [
          { id: '1', body: 'Mensaje propio', authorUsername: null, createdAt: '2026-08-29T18:00:00Z', isOwn: true },
          { id: '2', body: 'Mensaje ajeno', authorUsername: 'lucia', createdAt: '2026-08-29T18:05:00Z', isOwn: false },
          { id: '3', body: 'Mensaje anónimo', authorUsername: null, createdAt: '2026-08-29T18:10:00Z', isOwn: false },
        ],
      }

      render(<EventChat eventId="evt-123" />)

      expect(screen.getByText('Vos')).toBeInTheDocument()
      expect(screen.getByText('lucia')).toBeInTheDocument()
      expect(screen.getByText('Alguien')).toBeInTheDocument()
    }
  )

  it('sends a message, triggers mutation and clears input on success', async () => {
    const user = userEvent.setup()
    queryData = { eventMessages: [] }

    render(<EventChat eventId="evt-123" />)

    const textarea = screen.getByPlaceholderText('Escribí un mensaje...')
    await user.type(textarea, 'Nos vemos adentro!')

    const submitBtn = screen.getByRole('button', { name: 'Enviar' })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(executeMutation).toHaveBeenCalledWith({ eventId: 'evt-123', body: 'Nos vemos adentro!' })
    })

    expect(textarea).toHaveValue('')
    expect(reexecuteQuery).toHaveBeenCalledWith({ requestPolicy: 'network-only' })
  })

  it('shows error and preserves written text when mutation fails', async () => {
    const user = userEvent.setup()
    executeMutation.mockResolvedValue({
      data: { sendEventMessage: { success: false, error: 'El mensaje es demasiado largo.' } },
    })

    render(<EventChat eventId="evt-123" />)

    const textarea = screen.getByPlaceholderText('Escribí un mensaje...')
    await user.type(textarea, 'Texto que no pudo enviarse')

    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('El mensaje es demasiado largo.')
    })

    expect(textarea).toHaveValue('Texto que no pudo enviarse')
  })

  it('polls reexecuteQuery with network-only after the 5s interval', () => {
    vi.useFakeTimers()
    render(<EventChat eventId="evt-123" />)

    expect(reexecuteQuery).not.toHaveBeenCalled()

    vi.advanceTimersByTime(5000)

    expect(reexecuteQuery).toHaveBeenCalledWith({ requestPolicy: 'network-only' })

    vi.useRealTimers()
  })

  it('renders an invitation message when the thread is empty', () => {
    queryData = { eventMessages: [] }

    render(<EventChat eventId="evt-123" />)

    expect(
      screen.getByText('No hay mensajes todavía. Escribí el primero para empezar a coordinar.')
    ).toBeInTheDocument()
  })
})
