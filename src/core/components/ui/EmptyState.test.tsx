// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from '@/src/core/components/ui/EmptyState'

describe('EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState title="Tu wishlist está vacía" />)
    expect(screen.getByText('Tu wishlist está vacía')).toBeInTheDocument()
  })

  it('renders the description only when provided', () => {
    const { rerender } = render(
      <EmptyState title="Vacío" description="Agregá tu primer show." />
    )
    expect(screen.getByText('Agregá tu primer show.')).toBeInTheDocument()

    rerender(<EmptyState title="Vacío" />)
    expect(screen.queryByText('Agregá tu primer show.')).not.toBeInTheDocument()
  })

  it('renders an action link with the given href and label', () => {
    render(
      <EmptyState
        title="Vacío"
        action={{ label: 'Explorar Artistas', href: '/artists' }}
      />
    )
    expect(screen.getByRole('link', { name: 'Explorar Artistas' })).toHaveAttribute(
      'href',
      '/artists'
    )
  })

  it('renders a custom icon when provided instead of the default placeholder', () => {
    render(<EmptyState title="Vacío" icon={<span data-testid="custom-icon">★</span>} />)
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
  })

  it('renders additional children', () => {
    render(
      <EmptyState title="Vacío">
        <p>Contenido extra</p>
      </EmptyState>
    )
    expect(screen.getByText('Contenido extra')).toBeInTheDocument()
  })
})
