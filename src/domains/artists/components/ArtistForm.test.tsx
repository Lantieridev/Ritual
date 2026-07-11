// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ArtistForm } from '@/src/domains/artists/components/ArtistForm'

describe('ArtistForm', () => {
  it('submits the name and genre, mapping a blank genre to undefined', async () => {
    const createArtist = vi.fn().mockResolvedValue({})
    render(<ArtistForm createArtist={createArtist} />)

    await userEvent.type(screen.getByLabelText(/Nombre del artista/), 'Bandalos Chinos')
    await userEvent.click(screen.getByRole('button', { name: 'Crear artista' }))

    await waitFor(() => {
      expect(createArtist).toHaveBeenCalledWith({ name: 'Bandalos Chinos', genre: undefined })
    })
  })

  it('includes the genre when provided', async () => {
    const createArtist = vi.fn().mockResolvedValue({})
    render(<ArtistForm createArtist={createArtist} />)

    await userEvent.type(screen.getByLabelText(/Nombre del artista/), 'Bandalos Chinos')
    await userEvent.type(screen.getByLabelText('Género'), 'Indie')
    await userEvent.click(screen.getByRole('button', { name: 'Crear artista' }))

    await waitFor(() => {
      expect(createArtist).toHaveBeenCalledWith({ name: 'Bandalos Chinos', genre: 'Indie' })
    })
  })

  it('shows the error and re-enables the form when creation fails', async () => {
    const createArtist = vi.fn().mockResolvedValue({ error: 'Ya existe un registro con esos datos.' })
    render(<ArtistForm createArtist={createArtist} />)

    await userEvent.type(screen.getByLabelText(/Nombre del artista/), 'Bandalos Chinos')
    await userEvent.click(screen.getByRole('button', { name: 'Crear artista' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Ya existe un registro con esos datos.')
    })
    expect(screen.getByRole('button', { name: 'Crear artista' })).toBeEnabled()
  })
})
