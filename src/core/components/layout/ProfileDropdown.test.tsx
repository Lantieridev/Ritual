// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from '@supabase/supabase-js'

const mockSignout = vi.fn()

vi.mock('@/src/core/auth/actions', () => ({
  signout: (...args: unknown[]) => mockSignout(...args),
}))

import { ProfileDropdown } from '@/src/core/components/layout/ProfileDropdown'

const user = { email: 'martin@example.com' } as User

describe('ProfileDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is closed by default', () => {
    render(<ProfileDropdown user={user} />)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens the menu on click, showing the user email and menu items', async () => {
    render(<ProfileDropdown user={user} />)

    await userEvent.click(screen.getByRole('button'))

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByText('martin@example.com')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Mi Perfil' })).toHaveAttribute('href', '/profile')
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes the menu when Escape is pressed', async () => {
    render(<ProfileDropdown user={user} />)
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes the menu when a menu item is clicked', async () => {
    render(<ProfileDropdown user={user} />)
    await userEvent.click(screen.getByRole('button'))

    await userEvent.click(screen.getByRole('menuitem', { name: 'Wishlist' }))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('calls signout when "Cerrar Sesión" is clicked', async () => {
    render(<ProfileDropdown user={user} />)
    await userEvent.click(screen.getByRole('button'))

    await userEvent.click(screen.getByRole('menuitem', { name: 'Cerrar Sesión' }))

    expect(mockSignout).toHaveBeenCalledTimes(1)
  })

  it('falls back to "U" when the user has no email', () => {
    render(<ProfileDropdown user={{ email: undefined } as unknown as User} />)
    expect(screen.getByText('U')).toBeInTheDocument()
  })
})
