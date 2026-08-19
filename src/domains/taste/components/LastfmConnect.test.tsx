// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const executeMutation = vi.fn()
const refresh = vi.fn()

vi.mock('urql', async () => {
  const actual = await vi.importActual<typeof import('urql')>('urql')
  return { ...actual, useMutation: () => [{ fetching: false }, executeMutation] }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

import { LastfmConnect } from '@/src/domains/taste/components/LastfmConnect'

describe('LastfmConnect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the connect form when there is no saved username', () => {
    render(<LastfmConnect />)

    expect(screen.getByLabelText('Usuario de Last.fm')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Conectar' })).toBeInTheDocument()
  })

  it('submits the typed username through connectLastfm', async () => {
    executeMutation.mockResolvedValue({ data: { connectLastfm: { error: null } } })
    render(<LastfmConnect />)

    await userEvent.type(screen.getByLabelText('Usuario de Last.fm'), 'realuser')
    await userEvent.click(screen.getByRole('button', { name: 'Conectar' }))

    await waitFor(() => {
      expect(executeMutation).toHaveBeenCalledWith({ username: 'realuser' })
    })
    expect(refresh).toHaveBeenCalled()
  })

  it('shows the unknown-username error and stays on the connect form', async () => {
    executeMutation.mockResolvedValue({
      data: { connectLastfm: { error: 'No encontramos ese usuario en Last.fm.' } },
    })
    render(<LastfmConnect />)

    await userEvent.type(screen.getByLabelText('Usuario de Last.fm'), 'ghostuser')
    await userEvent.click(screen.getByRole('button', { name: 'Conectar' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('No encontramos ese usuario en Last.fm.')
    })
    expect(screen.getByLabelText('Usuario de Last.fm')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('shows the connected state with a data-deletion notice when a username is already saved', () => {
    render(<LastfmConnect lastfmUsername="rj" />)

    expect(screen.getByText(/Conectado como/)).toHaveTextContent('rj')
    expect(screen.getByText(/se borran los artistas importados/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desconectar' })).toBeInTheDocument()
  })

  it('disconnects and returns to the connect form', async () => {
    executeMutation.mockResolvedValue({ data: { disconnectLastfm: { error: null } } })
    render(<LastfmConnect lastfmUsername="rj" />)

    await userEvent.click(screen.getByRole('button', { name: 'Desconectar' }))

    await waitFor(() => {
      expect(executeMutation).toHaveBeenCalledWith({})
    })
    await waitFor(() => {
      expect(screen.getByLabelText('Usuario de Last.fm')).toBeInTheDocument()
    })
    expect(refresh).toHaveBeenCalled()
  })
})
