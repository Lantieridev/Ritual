// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CollectionDiaryHeader } from './CollectionDiaryHeader'

describe('CollectionDiaryHeader', () => {
  it('renders two Links labeled "Grilla" and "Lista"', () => {
    render(<CollectionDiaryHeader headline="3 shows · 2020 → hoy" view="grilla" />)

    expect(screen.getByRole('link', { name: 'Grilla' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lista' })).toBeInTheDocument()
  })

  it('marks only the active view link with aria-current when the grid is showing', () => {
    render(<CollectionDiaryHeader headline={null} view="grilla" />)

    expect(screen.getByRole('link', { name: 'Grilla' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('link', { name: 'Lista' })).not.toHaveAttribute('aria-current')
  })

  it('marks only the active view link with aria-current when the list is showing', () => {
    render(<CollectionDiaryHeader headline={null} view="lista" />)

    expect(screen.getByRole('link', { name: 'Lista' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('link', { name: 'Grilla' })).not.toHaveAttribute('aria-current')
  })

  it('points "Grilla" at the canonical /coleccion URL and "Lista" at ?vista=lista', () => {
    render(<CollectionDiaryHeader headline={null} view="grilla" />)

    expect(screen.getByRole('link', { name: 'Grilla' })).toHaveAttribute('href', '/coleccion')
    expect(screen.getByRole('link', { name: 'Lista' })).toHaveAttribute('href', '/coleccion?vista=lista')
  })

  it('renders the headline text when provided', () => {
    render(<CollectionDiaryHeader headline="147 shows · 2011 → hoy" view="grilla" />)

    expect(screen.getByText('147 shows · 2011 → hoy')).toBeInTheDocument()
  })

  it('renders nothing extra when headline is null (no invented count)', () => {
    render(<CollectionDiaryHeader headline={null} view="grilla" />)

    expect(screen.queryByText(/shows ·/)).not.toBeInTheDocument()
  })
})
