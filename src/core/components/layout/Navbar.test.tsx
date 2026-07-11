// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'

let mockPathname = '/'

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

import { Navbar } from '@/src/core/components/layout/Navbar'

describe('Navbar', () => {
  it('shows an "Ingresar" link when there is no user', () => {
    mockPathname = '/'
    render(<Navbar user={null} />)
    expect(screen.getByRole('link', { name: 'Ingresar' })).toHaveAttribute('href', '/login')
  })

  it('shows the profile dropdown trigger when a user is logged in', () => {
    mockPathname = '/'
    render(<Navbar user={{ email: 'martin@example.com' } as User} />)
    expect(screen.queryByRole('link', { name: 'Ingresar' })).not.toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('marks the nav link matching the current path as active', () => {
    mockPathname = '/stats'
    render(<Navbar user={null} />)
    expect(screen.getByRole('link', { name: 'Stats' })).toHaveClass('text-white')
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveClass('text-white')
  })

  it('only marks "Inicio" active on an exact match, not as a prefix of every other route', () => {
    mockPathname = '/stats'
    render(<Navbar user={null} />)
    // '/stats'.startsWith('/') would be true for every route if home used a prefix match
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveClass('text-white')
  })
})
