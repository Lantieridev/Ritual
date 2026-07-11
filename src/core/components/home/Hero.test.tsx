// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Hero } from '@/src/core/components/home/Hero'

describe('Hero', () => {
  it('renders the main heading', () => {
    render(<Hero />)
    expect(screen.getByRole('heading', { name: /Tu Historial de Recitales/ })).toBeInTheDocument()
  })

  it('links "Buscar nuevo show" to the search route', () => {
    render(<Hero />)
    expect(screen.getByRole('link', { name: 'Buscar nuevo show' })).toHaveAttribute('href', '/buscar')
  })

  it('anchors "Ver mis recitales" to the #recitales section', () => {
    render(<Hero />)
    expect(screen.getByRole('link', { name: 'Ver mis recitales' })).toHaveAttribute('href', '#recitales')
  })
})
