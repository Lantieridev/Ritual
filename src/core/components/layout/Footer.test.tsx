// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Footer } from '@/src/core/components/layout/Footer'

describe('Footer', () => {
  it('renders the current year in the copyright line', () => {
    render(<Footer />)
    expect(screen.getByText(new RegExp(String(new Date().getFullYear())))).toBeInTheDocument()
  })

  it('renders links to search and the collection', () => {
    render(<Footer />)
    expect(screen.getByRole('link', { name: 'Buscar' })).toHaveAttribute('href', '/buscar')
    expect(screen.getByRole('link', { name: 'Colección' })).toHaveAttribute('href', '/coleccion')
  })
})
