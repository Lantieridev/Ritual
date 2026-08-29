// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockUploadEventPhoto = vi.fn()
const mockDeleteEventPhoto = vi.fn()

vi.mock('@/src/domains/events/service', () => ({
  uploadEventPhoto: (...args: unknown[]) => mockUploadEventPhoto(...args),
  deleteEventPhoto: (...args: unknown[]) => mockDeleteEventPhoto(...args),
}))

import { PhotoGallery } from '@/src/domains/events/components/PhotoGallery'
import type { EventPhoto } from '@/src/domains/events/service'

const photo: EventPhoto = {
  id: 'p1',
  event_id: 'e1',
  storage_path: 'e1/1.jpg',
  caption: 'Buena toma',
  created_at: 't',
  url: 'https://cdn.test/p1.jpg',
}

describe('PhotoGallery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the upload button but no grid when there are no photos', () => {
    render(<PhotoGallery eventId="e1" initialPhotos={[]} />)
    expect(screen.getByText(/Agregar foto/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ver foto ampliada/ })).not.toBeInTheDocument()
  })

  it('renders a trigger button for each photo', () => {
    render(<PhotoGallery eventId="e1" initialPhotos={[photo]} />)
    expect(screen.getByRole('button', { name: 'Ver foto ampliada: Buena toma' })).toBeInTheDocument()
  })

  it('opens the lightbox as an accessible dialog when a photo is clicked', async () => {
    render(<PhotoGallery eventId="e1" initialPhotos={[photo]} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ver foto ampliada: Buena toma' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus()
  })

  it('closes the lightbox on Escape and returns focus to the trigger', async () => {
    render(<PhotoGallery eventId="e1" initialPhotos={[photo]} />)
    const trigger = screen.getByRole('button', { name: 'Ver foto ampliada: Buena toma' })

    await userEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('uploads a selected file and adds it to the grid', async () => {
    const newPhoto: EventPhoto = { ...photo, id: 'p2', caption: null }
    mockUploadEventPhoto.mockResolvedValue({ photo: newPhoto })
    render(<PhotoGallery eventId="e1" initialPhotos={[]} />)

    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ver foto ampliada' })).toBeInTheDocument()
    })
    expect(mockUploadEventPhoto).toHaveBeenCalledTimes(1)
  })

  it('shows the error message when upload fails', async () => {
    mockUploadEventPhoto.mockResolvedValue({ error: 'La imagen no puede superar 5MB.' })
    render(<PhotoGallery eventId="e1" initialPhotos={[]} />)

    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(screen.getByText('La imagen no puede superar 5MB.')).toBeInTheDocument()
    })
  })

  it('deletes a photo without opening the lightbox', async () => {
    mockDeleteEventPhoto.mockResolvedValue({})
    render(<PhotoGallery eventId="e1" initialPhotos={[photo]} />)

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar foto' }))

    await waitFor(() => {
      expect(mockDeleteEventPhoto).toHaveBeenCalledWith('p1', 'e1')
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Ver foto ampliada/ })).not.toBeInTheDocument()
    })
  })

  it('closes the lightbox when the currently viewed photo is deleted', async () => {
    mockDeleteEventPhoto.mockResolvedValue({})
    render(<PhotoGallery eventId="e1" initialPhotos={[photo]} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ver foto ampliada: Buena toma' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar foto' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
