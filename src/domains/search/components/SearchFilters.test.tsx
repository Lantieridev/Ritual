// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SearchFilters } from '@/src/domains/search/components/SearchFilters'
import { buscarHref } from '@/src/domains/search/rows'

describe('SearchFilters', () => {
  it('renders exactly the five required chips, each linking to its own filtro', () => {
    render(<SearchFilters active="todo" query="obras" />)

    const labels = ['Todo', 'Artistas', 'Sedes', 'Festivales', 'Cerca']
    for (const label of labels) {
      const link = screen.getByRole('link', { name: label })
      expect(link).toBeInTheDocument()
    }
    expect(screen.getAllByRole('link')).toHaveLength(5)

    expect(screen.getByRole('link', { name: 'Artistas' })).toHaveAttribute(
      'href',
      buscarHref({ q: 'obras', filtro: 'artistas' })
    )
  })

  it('marks only the active chip as current, the rest are not', () => {
    render(<SearchFilters active="sedes" query="" />)

    expect(screen.getByRole('link', { name: 'Sedes' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('link', { name: 'Todo' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Cerca' })).not.toHaveAttribute('aria-current')
  })
})
