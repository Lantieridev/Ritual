// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const signup = vi.fn()

vi.mock('@/src/core/auth/actions', () => ({
  signup: (...args: unknown[]) => signup(...args),
}))

import { SignupForm } from '@/src/domains/auth/components/SignupForm'

const GENRES = [
  { key: 'rock-nacional', label: 'Rock Nacional' },
  { key: 'indie', label: 'Indie' },
]

describe('SignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signup.mockResolvedValue(null)
  })

  it('renders every genre chip and the birth year field', () => {
    render(<SignupForm genres={GENRES} />)

    expect(screen.getByRole('button', { name: 'Rock Nacional' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Indie' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Año de nacimiento/)).toBeInTheDocument()
  })

  it('submits the selected genres and birth year through the signup action', async () => {
    render(<SignupForm genres={GENRES} />)

    await userEvent.type(screen.getByLabelText('Email'), 'new@example.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Rock Nacional' }))
    await userEvent.type(screen.getByLabelText(/Año de nacimiento/), '1995')
    await userEvent.click(screen.getByRole('button', { name: 'Emitir mi talonario' }))

    await waitFor(() => expect(signup).toHaveBeenCalledTimes(1))
    const submittedFormData = signup.mock.calls[0][1] as FormData
    expect(submittedFormData.getAll('genres')).toEqual(['rock-nacional'])
    expect(submittedFormData.get('birthYear')).toBe('1995')
  })

  it('surfaces the bad-year error message returned by the signup action', async () => {
    signup.mockResolvedValue({ error: 'Revisá el año de nacimiento.' })
    render(<SignupForm genres={GENRES} />)

    await userEvent.type(screen.getByLabelText('Email'), 'new@example.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secret123')
    await userEvent.type(screen.getByLabelText(/Año de nacimiento/), '1850')
    await userEvent.click(screen.getByRole('button', { name: 'Emitir mi talonario' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Revisá el año de nacimiento.')
  })
})
