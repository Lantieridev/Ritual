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

import { TasteProfileForm } from '@/src/domains/taste/components/TasteProfileForm'

const GENRES = [
  { key: 'indie', label: 'Indie' },
  { key: 'pop', label: 'Pop' },
  { key: 'rock-nacional', label: 'Rock Nacional' },
]

describe('TasteProfileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    executeMutation.mockResolvedValue({ data: { updateTasteProfile: { error: null } } })
  })

  it('pre-fills the picker and the birth year from the current taste profile', () => {
    render(<TasteProfileForm genres={GENRES} defaultGenres={['indie']} defaultBirthYear={1995} />)

    expect(screen.getByRole('button', { name: 'Indie' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Pop' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByLabelText('Año de nacimiento')).toHaveValue(1995)
  })

  it('submits the edited genres and birth year through updateTasteProfile', async () => {
    render(<TasteProfileForm genres={GENRES} defaultGenres={['indie']} defaultBirthYear={1995} />)

    await userEvent.click(screen.getByRole('button', { name: 'Pop' }))
    await userEvent.clear(screen.getByLabelText('Año de nacimiento'))
    await userEvent.type(screen.getByLabelText('Año de nacimiento'), '1990')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar preferencias' }))

    await waitFor(() => {
      expect(executeMutation).toHaveBeenCalledWith({
        input: { genres: ['indie', 'pop'], birthYear: 1990 },
      })
    })
  })

  it('sends a null birth year when the field is left blank', async () => {
    render(<TasteProfileForm genres={GENRES} />)

    await userEvent.click(screen.getByRole('button', { name: 'Guardar preferencias' }))

    await waitFor(() => {
      expect(executeMutation).toHaveBeenCalledWith({ input: { genres: [], birthYear: null } })
    })
  })

  it('shows the business error returned by the resolver', async () => {
    executeMutation.mockResolvedValue({
      data: { updateTasteProfile: { error: 'Revisá el año de nacimiento.' } },
    })
    render(<TasteProfileForm genres={GENRES} />)

    await userEvent.click(screen.getByRole('button', { name: 'Guardar preferencias' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Revisá el año de nacimiento.')
    })
    expect(refresh).not.toHaveBeenCalled()
  })

  it('confirms the save and refreshes the route on success', async () => {
    render(<TasteProfileForm genres={GENRES} />)

    await userEvent.click(screen.getByRole('button', { name: 'Guardar preferencias' }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Preferencias guardadas.')
    })
    expect(refresh).toHaveBeenCalled()
  })
})
