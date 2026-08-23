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

import { ArtistForm } from '@/src/domains/artists/components/ArtistForm'

describe('ArtistForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    executeMutation.mockResolvedValue({ data: { createArtist: { id: 'a-new' } } })
  })

  it('submits the name and genre, mapping a blank genre to undefined', async () => {
    render(<ArtistForm />)

    await userEvent.type(screen.getByLabelText(/Nombre del artista/), 'Bandalos Chinos')
    await userEvent.click(screen.getByRole('button', { name: 'Crear artista' }))

    await waitFor(() => {
      expect(executeMutation).toHaveBeenCalledWith({
        input: { name: 'Bandalos Chinos', genre: undefined },
      })
    })
  })

  it('includes the genre when provided', async () => {
    render(<ArtistForm />)

    await userEvent.type(screen.getByLabelText(/Nombre del artista/), 'Bandalos Chinos')
    await userEvent.type(screen.getByLabelText('Género'), 'Indie')
    await userEvent.click(screen.getByRole('button', { name: 'Crear artista' }))

    await waitFor(() => {
      expect(executeMutation).toHaveBeenCalledWith({
        input: { name: 'Bandalos Chinos', genre: 'Indie' },
      })
    })
  })

  it('shows the error and re-enables the form when creation fails', async () => {
    executeMutation.mockResolvedValue({
      data: { createArtist: { error: 'Ya existe un registro con esos datos.' } },
    })
    render(<ArtistForm />)

    await userEvent.type(screen.getByLabelText(/Nombre del artista/), 'Bandalos Chinos')
    await userEvent.click(screen.getByRole('button', { name: 'Crear artista' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Ya existe un registro con esos datos.')
    })
    expect(screen.getByRole('button', { name: 'Crear artista' })).toBeEnabled()
    expect(push).not.toHaveBeenCalled()
  })

  it('navigates to the artists list once creation succeeds', async () => {
    render(<ArtistForm />)

    await userEvent.type(screen.getByLabelText(/Nombre del artista/), 'Bandalos Chinos')
    await userEvent.click(screen.getByRole('button', { name: 'Crear artista' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/artists'))
  })
})
