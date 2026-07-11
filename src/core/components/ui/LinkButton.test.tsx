// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LinkButton } from '@/src/core/components/ui/LinkButton'

describe('LinkButton', () => {
  it('renders a link to the given href', () => {
    render(<LinkButton href="/events/nuevo">Cargar recital</LinkButton>)
    expect(screen.getByRole('link', { name: 'Cargar recital' })).toHaveAttribute(
      'href',
      '/events/nuevo'
    )
  })

  it('applies the primary variant by default', () => {
    render(<LinkButton href="/events/nuevo">Cargar recital</LinkButton>)
    expect(screen.getByRole('link')).toHaveClass('bg-white')
  })

  it('applies the secondary variant when requested', () => {
    render(
      <LinkButton href="/events/nuevo" variant="secondary">
        Cargar recital
      </LinkButton>
    )
    expect(screen.getByRole('link')).toHaveClass('border')
  })
})
