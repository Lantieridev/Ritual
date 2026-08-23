// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const executeMutation = vi.fn()
const push = vi.fn()

vi.mock('urql', async () => {
  const actual = await vi.importActual<typeof import('urql')>('urql')
  return { ...actual, useMutation: () => [{ fetching: false }, executeMutation] }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

import { DeleteEventAction } from '@/src/domains/events/components/DeleteEventAction'
import { TRANSPORT_ERROR_MESSAGE } from '@/src/graphql/mutation-result'
import { transportError } from '@/src/graphql/transport-failure.testing'
import type { EventWithRelations } from '@/src/core/types'

const event = { id: 'e1', name: 'Show de prueba' } as EventWithRelations

async function confirmDelete() {
  await userEvent.click(screen.getByRole('button', { name: 'Romper este talón' }))
  await userEvent.click(screen.getByRole('button', { name: /Sí, eliminar/ }))
}

describe('DeleteEventAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    executeMutation.mockResolvedValue({ data: { deleteEvent: { error: null } } })
  })

  it('deletes the event by id and goes home', async () => {
    render(<DeleteEventAction event={event} />)

    await confirmDelete()

    await waitFor(() => expect(executeMutation).toHaveBeenCalledWith({ id: 'e1' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'))
  })

  it('surfaces the resolver error and stays on the page', async () => {
    executeMutation.mockResolvedValue({
      data: { deleteEvent: { error: 'No se pudo eliminar el recital.' } },
    })
    render(<DeleteEventAction event={event} />)

    await confirmDelete()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo eliminar el recital.')
    })
    expect(push).not.toHaveBeenCalled()
  })

  // Navegar al home tras un borrado que nunca llegó al resolver haría creer
  // que el talón se rompió cuando sigue estando.
  it('does not navigate when the request never reaches the resolver', async () => {
    executeMutation.mockResolvedValue({ data: undefined, error: transportError() })
    render(<DeleteEventAction event={event} />)

    await confirmDelete()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(TRANSPORT_ERROR_MESSAGE)
    })
    expect(push).not.toHaveBeenCalled()
  })
})
