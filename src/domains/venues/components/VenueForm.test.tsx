// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VenueForm } from '@/src/domains/venues/components/VenueForm'

describe('VenueForm', () => {
  it('submits all field values, mapping blank optionals to undefined', async () => {
    const createVenue = vi.fn().mockResolvedValue({})
    render(<VenueForm createVenue={createVenue} />)

    await userEvent.type(screen.getByLabelText(/Nombre de la sede/), 'Niceto Club')
    await userEvent.type(screen.getByLabelText('Ciudad'), 'CABA')
    await userEvent.click(screen.getByRole('button', { name: 'Crear sede' }))

    await waitFor(() => {
      expect(createVenue).toHaveBeenCalledWith({
        name: 'Niceto Club',
        city: 'CABA',
        address: undefined,
        country: undefined,
      })
    })
  })

  it('shows the error and re-enables the form when creation fails', async () => {
    const createVenue = vi.fn().mockResolvedValue({ error: 'Ya existe un registro con esos datos.' })
    render(<VenueForm createVenue={createVenue} />)

    await userEvent.type(screen.getByLabelText(/Nombre de la sede/), 'Niceto Club')
    await userEvent.click(screen.getByRole('button', { name: 'Crear sede' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Ya existe un registro con esos datos.')
    })
    expect(screen.getByRole('button', { name: 'Crear sede' })).toBeEnabled()
  })

  it('links "Cancelar" to the venues list', () => {
    render(<VenueForm createVenue={vi.fn()} />)
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/venues')
  })
})
