// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import CollectionPage from '@/app/coleccion/page'
import { listMyEvents } from '@/src/domains/events/service'
import type { EventWithAttendance } from '@/src/domains/events/service'

vi.mock('@/src/domains/events/service', () => ({
  listMyEvents: vi.fn(),
}))

function wentEvent(overrides: Partial<EventWithAttendance> & { id: string; date: string }): EventWithAttendance {
  return {
    name: null,
    venue_id: null,
    venues: null,
    lineups: null,
    attendance: [{ id: `att-${overrides.id}`, status: 'went', user_id: 'u1', rating: null, review: null }],
    ...overrides,
  } as EventWithAttendance
}

type ElementWithChildren = ReactElement<{ 'data-testid'?: string; className?: string; children?: ReactNode }>

/**
 * `ArtistsShelvesView`/`VenuesTab`/`FestivalsTab` (escritorio, no tocados por
 * este WU) son Server Components async sin `Suspense` — react-dom, el
 * renderer que usa @testing-library bajo Vitest, no puede montar un
 * componente async sin una pipeline RSC real detrás (a diferencia del
 * `next dev`/build real), y sin un `Suspense` que atrape la promesa
 * suspendida el render entero queda vacío. Por eso la regresión de
 * escritorio inspecciona el árbol de elementos que devuelve `CollectionPage`
 * directamente en vez de montarlo con `render()` — nunca se invoca el cuerpo
 * de esos componentes, así que nunca dispara el problema.
 */
function findByTestId(node: ReactNode, testId: string): ElementWithChildren | null {
  if (node == null || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByTestId(child, testId)
      if (found) return found
    }
    return null
  }
  const el = node as ElementWithChildren
  if (el.props?.['data-testid'] === testId) return el
  return findByTestId(el.props?.children ?? null, testId)
}

function typeNamesOf(node: ReactNode): string[] {
  if (node == null || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(typeNamesOf)
  const el = node as ElementWithChildren
  const name = typeof el.type === 'function' ? el.type.name : String(el.type)
  return [name, ...typeNamesOf(el.props?.children ?? null)]
}

describe('CollectionPage — desktop regression (coleccion-mobile WU3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listMyEvents).mockResolvedValue([])
  })

  it('wraps the desktop tabs tree in hidden md:block with the coleccion-desktop testid', async () => {
    const element = await CollectionPage({ searchParams: Promise.resolve({}) })
    const desktop = findByTestId(element, 'coleccion-desktop')

    expect(desktop).not.toBeNull()
    expect(desktop!.props.className).toMatch(/hidden md:block/)
  })

  it('?tab=sedes still selects VenuesTab inside the desktop tree', async () => {
    const element = await CollectionPage({ searchParams: Promise.resolve({ tab: 'sedes' }) })
    const desktop = findByTestId(element, 'coleccion-desktop')!

    const types = typeNamesOf(desktop)
    expect(types).toContain('VenuesTab')
    expect(types).not.toContain('FestivalsTab')
    expect(types).not.toContain('ArtistsShelvesView')
  })

  it('?tab=festivales still selects FestivalsTab inside the desktop tree', async () => {
    const element = await CollectionPage({ searchParams: Promise.resolve({ tab: 'festivales' }) })
    const desktop = findByTestId(element, 'coleccion-desktop')!

    expect(typeNamesOf(desktop)).toContain('FestivalsTab')
  })

  it('the mobile-only ?vista param never affects the desktop tab selected', async () => {
    const element = await CollectionPage({ searchParams: Promise.resolve({ tab: 'sedes', vista: 'lista' }) })
    const desktop = findByTestId(element, 'coleccion-desktop')!

    expect(typeNamesOf(desktop)).toContain('VenuesTab')
  })

  it('the mobile diary tree stays a sibling of the desktop tree, not nested inside it', async () => {
    const element = await CollectionPage({ searchParams: Promise.resolve({ vista: 'lista' }) })
    const desktop = findByTestId(element, 'coleccion-desktop')!

    expect(findByTestId(desktop, 'coleccion-mobile')).toBeNull()
    expect(findByTestId(element, 'coleccion-mobile')).not.toBeNull()
  })
})

describe('CollectionPage — mobile diary screen (coleccion-mobile WU3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function renderMobile(searchParams: { tab?: 'artistas' | 'sedes' | 'festivales'; vista?: string }) {
    const element = await CollectionPage({ searchParams: Promise.resolve(searchParams) })
    const mobile = findByTestId(element, 'coleccion-mobile')!
    render(mobile)
    return within(screen.getByTestId('coleccion-mobile'))
  }

  it('shows the honest empty-state copy and CTA when there are zero "went" events', async () => {
    vi.mocked(listMyEvents).mockResolvedValue([])

    const mobile = await renderMobile({})

    expect(mobile.getByText('Todavía no cargaste ningún show.')).toBeInTheDocument()
    expect(mobile.getByText('Los que ya viste también cuentan.')).toBeInTheDocument()
    expect(mobile.getByRole('link', { name: 'Cargar un show' })).toHaveAttribute('href', '/events/nuevo')
  })

  it('renders no grid/list markup in the empty state (no invented rows)', async () => {
    vi.mocked(listMyEvents).mockResolvedValue([])

    const mobile = await renderMobile({})

    expect(mobile.queryByRole('link', { name: 'Grilla' })).not.toBeInTheDocument()
    expect(mobile.queryByRole('link', { name: 'Lista' })).not.toBeInTheDocument()
  })

  it('renders the grid by default (no ?vista param) when there are "went" events', async () => {
    vi.mocked(listMyEvents).mockResolvedValue([
      wentEvent({ id: 'ev1', date: '2020-01-01', name: 'Show en Obras' }),
    ])

    const mobile = await renderMobile({})

    expect(mobile.getByRole('link', { name: 'Grilla' })).toHaveAttribute('aria-current', 'true')
    expect(mobile.getByText('Show en Obras')).toBeInTheDocument()
  })

  it('renders the list when ?vista=lista, with a 60px row', async () => {
    vi.mocked(listMyEvents).mockResolvedValue([
      wentEvent({ id: 'ev1', date: '2020-01-01', name: 'Show en Obras' }),
    ])

    const mobile = await renderMobile({ vista: 'lista' })

    expect(mobile.getByRole('link', { name: 'Lista' })).toHaveAttribute('aria-current', 'true')
    const row = mobile.getByText('Show en Obras').closest('a')!
    expect(row.className).toMatch(/min-h-\[60px\]/)
  })
})
