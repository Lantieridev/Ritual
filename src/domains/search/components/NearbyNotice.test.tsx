// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NearbyNotice } from '@/src/domains/search/components/NearbyNotice'
import { routes } from '@/src/core/lib/routes'

describe('NearbyNotice', () => {
  it('no-session: explains a sign-in is needed and links to login', () => {
    render(<NearbyNotice status="no-session" />)

    expect(screen.getByText('«Cerca» necesita tu sesión')).toBeInTheDocument()
    expect(screen.getByText(/Entrá y guardá tu ciudad en el perfil/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', routes.login)
    expect(screen.queryByText(/km/i)).not.toBeInTheDocument()
  })

  it('no-city: explains a city is needed and links to the profile', () => {
    render(<NearbyNotice status="no-city" />)

    expect(screen.getByText('No sabemos desde dónde medir')).toBeInTheDocument()
    expect(screen.getByText(/Guardá tu ciudad en el perfil/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir al perfil' })).toHaveAttribute('href', routes.profile)
    expect(screen.queryByText(/km/i)).not.toBeInTheDocument()
  })
})
