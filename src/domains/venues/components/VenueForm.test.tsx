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

import { VenueForm } from '@/src/domains/venues/components/VenueForm'

describe('VenueForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    executeMutation.mockResolvedValue({ data: { createVenue: { id: 'v-new' } } })
  })

  it('submits all field values, mapping blank optionals to undefined', async () => {
    render(<VenueForm />)

    await userEvent.type(screen.getByLabelText(/Nombre de la sede/), 'Niceto Club')
    await userEvent.type(screen.getByLabelText('Ciudad'), 'CABA')
    await userEvent.click(screen.getByRole('button', { name: 'Crear sede' }))

    await waitFor(() => {
      expect(executeMutation).toHaveBeenCalledWith({
        input: {
          name: 'Niceto Club',
          city: 'CABA',
          address: undefined,
          country: undefined,
        },
      })
    })
  })

  it('navigates to the venues list once creation succeeds', async () => {
    render(<VenueForm />)

    await userEvent.type(screen.getByLabelText(/Nombre de la sede/), 'Niceto Club')
    await userEvent.click(screen.getByRole('button', { name: 'Crear sede' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/venues'))
  })

  it('shows the error and re-enables the form when creation fails', async () => {
    executeMutation.mockResolvedValue({
      data: { createVenue: { error: 'Ya existe un registro con esos datos.' } },
    })
    render(<VenueForm />)

    await userEvent.type(screen.getByLabelText(/Nombre de la sede/), 'Niceto Club')
    await userEvent.click(screen.getByRole('button', { name: 'Crear sede' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Ya existe un registro con esos datos.')
    })
    expect(screen.getByRole('button', { name: 'Crear sede' })).toBeEnabled()
    expect(push).not.toHaveBeenCalled()
  })

  // El id de la fila existente es lo que deja al usuario salir del error en
  // vez de quedar trabado repitiendo un nombre que ya está tomado.
  it('links to the existing venue when the name collides', async () => {
    executeMutation.mockResolvedValue({
      data: { createVenue: { error: 'Ya existe una sede con ese nombre.', existingId: 'v-1' } },
    })
    render(<VenueForm />)

    await userEvent.type(screen.getByLabelText(/Nombre de la sede/), 'Niceto Club')
    await userEvent.click(screen.getByRole('button', { name: 'Crear sede' }))

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Ver la sede existente/ })).toHaveAttribute(
        'href',
        '/venues/v-1'
      )
    })
  })

  it('links "Cancelar" to the venues list', () => {
    render(<VenueForm />)
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/venues')
  })
})
