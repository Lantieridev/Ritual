// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
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
    expect(screen.getByRole('link', { name: 'Números' })).toHaveClass('text-white')
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveClass('text-white')
  })

  it('only marks "Inicio" active on an exact match, not as a prefix of every other route', () => {
    mockPathname = '/stats'
    render(<Navbar user={null} />)
    // '/stats'.startsWith('/') would be true for every route if home used a prefix match
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveClass('text-white')
  })

  it('hides Gastos/Perfil (account-specific, not shared catalog) for an anonymous visitor', () => {
    render(<Navbar user={null} />)
    expect(screen.queryByRole('link', { name: 'Gastos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Perfil' })).not.toBeInTheDocument()
    // El catálogo compartido sigue visible sin sesión.
    expect(screen.getByRole('link', { name: 'Colección' })).toBeInTheDocument()
  })

  it('shows Gastos/Perfil once there is a logged-in user', () => {
    render(<Navbar user={{ email: 'martin@example.com' } as User} />)
    expect(screen.getByRole('link', { name: 'Gastos' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Perfil' })).toBeInTheDocument()
  })

  // Cargar un show es la acción principal de la app: el diseño la pone en la
  // nav, no escondida detrás de una pantalla.
  it('ofrece cargar un show desde la nav, solo con sesión', () => {
    render(<Navbar user={{ email: 'martin@example.com' } as User} />)
    expect(screen.getByRole('link', { name: '+ Cargar show' })).toHaveAttribute('href', '/events/nuevo')

    cleanup()
    render(<Navbar user={null} />)
    expect(screen.queryByRole('link', { name: '+ Cargar show' })).not.toBeInTheDocument()
  })

  // La wishlist salió de la nav a propósito: el handoff la resuelve como un
  // estado del artista y Colección ya la muestra en el estante "Los huecos".
  it('no duplica la wishlist en la nav', () => {
    render(<Navbar user={{ email: 'martin@example.com' } as User} />)
    expect(screen.queryByRole('link', { name: 'Wishlist' })).not.toBeInTheDocument()
  })
})
