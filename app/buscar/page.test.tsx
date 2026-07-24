// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import BuscarPage from '@/app/buscar/page'
import { searchCatalog, searchNearby } from '@/src/domains/search/service'
import type { CatalogSearchResults, NearbySearchResult } from '@/src/domains/search/service'

vi.mock('@/src/domains/search/service', () => ({
  searchCatalog: vi.fn(),
  searchNearby: vi.fn(),
}))

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: vi.fn(async () => ({ data: { user: null } })) } })),
}))

vi.mock('@/src/domains/auth/service', () => ({
  findProfile: vi.fn(async () => null),
}))

// El árbol de escritorio (siempre en el DOM, ver nota más abajo) monta
// <SearchEventsForm> en la tab "cartelera" (default sin `tab` en la URL),
// que usa useRouter/useSearchParams — necesitan mock fuera de un router real.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const EMPTY: CatalogSearchResults = { events: [], artists: [], venues: [], festivals: [] }

describe('BuscarPage — desktop archivo tab, festival rows (WU1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Ambos árboles (escritorio hidden md:block / mobile md:hidden) están
  // SIEMPRE en el DOM — jsdom no resuelve media queries, igual que en
  // HomeHeroStates.a11y.test.tsx. Con filtro="todo" (default) el mismo
  // festival aparece en los dos árboles, así que estas aserciones se
  // acotan al árbol de escritorio con `within`.

  it('renders a festival row group when searchCatalog returns festivals', async () => {
    vi.mocked(searchCatalog).mockResolvedValue({
      ...EMPTY,
      festivals: [{ id: 'f1', name: 'Cosquín Rock', edition: '2026', city: 'Córdoba', start_date: '2026-02-14' }],
    })

    const element = await BuscarPage({ searchParams: Promise.resolve({ tab: 'archivo', q: 'cosquin' }) })
    render(element)
    const desktop = within(screen.getByTestId('buscar-desktop'))

    expect(desktop.getByText(/Festivales \(1\)/)).toBeInTheDocument()
    expect(desktop.getByText('Cosquín Rock')).toBeInTheDocument()
    expect(desktop.getByText('Festival · 2026')).toBeInTheDocument()
  })

  it('renders no festival section when searchCatalog returns no festivals', async () => {
    vi.mocked(searchCatalog).mockResolvedValue({
      ...EMPTY,
      events: [{ id: 'e1', name: 'Show en Obras', date: '2026-01-01' }],
    })

    const element = await BuscarPage({ searchParams: Promise.resolve({ tab: 'archivo', q: 'obras' }) })
    render(element)
    const desktop = within(screen.getByTestId('buscar-desktop'))

    expect(desktop.queryByText(/Festivales/)).not.toBeInTheDocument()
    expect(desktop.getByText('Show en Obras')).toBeInTheDocument()
  })
})

describe('BuscarPage — mobile chip-filter screen (WU4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(searchCatalog).mockResolvedValue(EMPTY)
    vi.mocked(searchNearby).mockResolvedValue({ status: 'no-session' })
  })

  it('shows the honest empty-state prompt when there is no query — never "Sugeridos para vos"', async () => {
    const element = await BuscarPage({ searchParams: Promise.resolve({}) })
    render(element)
    const mobile = within(screen.getByTestId('buscar-mobile'))

    expect(mobile.getByText('Buscá entre lo que ya guardaste.')).toBeInTheDocument()
    expect(screen.queryByText(/Sugeridos para vos/i)).not.toBeInTheDocument()
  })

  it('filtro=artistas: renders only the matching artist row, with the chip marked active', async () => {
    vi.mocked(searchCatalog).mockResolvedValue({
      ...EMPTY,
      events: [{ id: 'e1', name: 'Show en Obras', date: '2026-01-01' }],
      artists: [{ id: 'a1', name: 'Divididos', genre: 'Rock' }],
    })

    const element = await BuscarPage({ searchParams: Promise.resolve({ q: 'div', filtro: 'artistas' }) })
    render(element)
    const mobile = within(screen.getByTestId('buscar-mobile'))

    const activeChip = mobile.getByRole('link', { name: 'Artistas' })
    expect(activeChip).toHaveAttribute('aria-current', 'true')
    expect(mobile.getByRole('link', { name: /Divididos/ })).toBeInTheDocument()
    expect(mobile.queryByRole('link', { name: /Show en Obras/ })).not.toBeInTheDocument()
  })

  it('filtro=cerca, sin sesión: muestra el aviso honesto y nunca "a N km"', async () => {
    const element = await BuscarPage({ searchParams: Promise.resolve({ filtro: 'cerca' }) })
    render(element)
    const mobile = within(screen.getByTestId('buscar-mobile'))

    expect(mobile.getByText('«Cerca» necesita tu sesión')).toBeInTheDocument()
    expect(mobile.queryByText(/km/i)).not.toBeInTheDocument()
    expect(searchCatalog).not.toHaveBeenCalled()
  })

  it('filtro=cerca, con sedes: muestra la distancia real vía SearchRowList', async () => {
    const ok: NearbySearchResult = { status: 'ok', venues: [{ id: 'v1', name: 'Estadio Obras', city: 'CABA', distanceKm: 3.4 }] }
    vi.mocked(searchNearby).mockResolvedValue(ok)

    const element = await BuscarPage({ searchParams: Promise.resolve({ filtro: 'cerca' }) })
    render(element)
    const mobile = within(screen.getByTestId('buscar-mobile'))

    expect(mobile.getByRole('link', { name: /Estadio Obras/ })).toBeInTheDocument()
    expect(mobile.getByText('A 3 KM')).toBeInTheDocument()
  })

  it('incluye el link de descubrimiento a cartelera, de baja jerarquía y no como sexto chip', async () => {
    const element = await BuscarPage({ searchParams: Promise.resolve({}) })
    render(element)
    const mobile = within(screen.getByTestId('buscar-mobile'))

    const link = mobile.getByRole('link', { name: /Buscá en cartelera/ })
    expect(link).toHaveAttribute('href', '/buscar?tab=cartelera')
    expect(mobile.getAllByRole('link', { name: /^(Todo|Artistas|Sedes|Festivales|Cerca)$/ })).toHaveLength(5)
  })
})
