// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import BuscarPage from '@/app/buscar/page'
import { searchCatalog } from '@/src/domains/search/service'
import type { CatalogSearchResults } from '@/src/domains/search/service'

vi.mock('@/src/domains/search/service', () => ({
  searchCatalog: vi.fn(),
}))

const EMPTY: CatalogSearchResults = { events: [], artists: [], venues: [], festivals: [] }

describe('BuscarPage — desktop archivo tab, festival rows (WU1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a festival row group when searchCatalog returns festivals', async () => {
    vi.mocked(searchCatalog).mockResolvedValue({
      ...EMPTY,
      festivals: [{ id: 'f1', name: 'Cosquín Rock', edition: '2026', city: 'Córdoba', start_date: '2026-02-14' }],
    })

    const element = await BuscarPage({ searchParams: Promise.resolve({ tab: 'archivo', q: 'cosquin' }) })
    render(element)

    expect(screen.getByText(/Festivales \(1\)/)).toBeInTheDocument()
    expect(screen.getByText('Cosquín Rock')).toBeInTheDocument()
    expect(screen.getByText('Festival · 2026')).toBeInTheDocument()
  })

  it('renders no festival section when searchCatalog returns no festivals', async () => {
    vi.mocked(searchCatalog).mockResolvedValue({
      ...EMPTY,
      events: [{ id: 'e1', name: 'Show en Obras', date: '2026-01-01' }],
    })

    const element = await BuscarPage({ searchParams: Promise.resolve({ tab: 'archivo', q: 'obras' }) })
    render(element)

    expect(screen.queryByText(/Festivales/)).not.toBeInTheDocument()
    expect(screen.getByText('Show en Obras')).toBeInTheDocument()
  })
})
