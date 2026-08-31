// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import HomePage from '@/app/page'
import { listMyEvents, listUpcomingEvents } from '@/src/domains/events/service'
import { getCurrentUserId } from '@/src/core/auth/session'
import { findProfile } from '@/src/domains/auth/service'
import { getFirstTimeSeeds } from '@/src/domains/recommendations/service'
import type { HomeHeroState } from '@/src/domains/events/home-view'
import type { ReactNode } from 'react'

/*
 * HomePage es un Server Component async con hijos async dentro de Suspense,
 * que jsdom no resuelve. Se llama a HomePage() directo, se mockea HomeHero
 * para capturar el estado que recibe, y se renderiza el árbol devuelto para
 * mirar el resto de la página (la sección "Tu archivo").
 */
const mockHomeHero = vi.fn(
  (props: {
    state: HomeHeroState
    recentSeen?: unknown[]
    initialOpen?: boolean
    suggestions?: ReactNode
    seeds?: Promise<{ names: string[]; note: string }>
  }) => <div data-testid="mock-home-hero">{props.state.kind}</div>
)

vi.mock('@/src/domains/events/components/HomeHero', () => ({
  HomeHero: (props: {
    state: HomeHeroState
    recentSeen?: unknown[]
    initialOpen?: boolean
    suggestions?: ReactNode
    seeds?: Promise<{ names: string[]; note: string }>
  }) => mockHomeHero(props),
}))

vi.mock('@/src/domains/recommendations/service', () => ({
  getHomeSuggestions: vi.fn(async () => ({ heading: { basis: 'none', hasCoords: false, sources: [], declaredGenreLabels: [] }, candidates: [] })),
  getFirstTimeSeeds: vi.fn(async () => ({ names: [], note: 'Para arrancar' })),
}))

vi.mock('@/src/domains/events/service', () => ({
  listMyEvents: vi.fn(async () => []),
  listUpcomingEvents: vi.fn(async () => []),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn(async () => null),
}))

vi.mock('@/src/domains/auth/service', () => ({
  findProfile: vi.fn(async () => null),
}))

vi.mock('@/src/core/lib/artist-image', () => ({
  getArtistImage: vi.fn(async () => ({ image: null })),
}))

vi.mock('@/src/core/lib/ticketmaster', () => ({
  isTicketmasterConfigured: vi.fn(() => false),
  searchTicketmasterEvents: vi.fn(async () => ({ events: [] })),
}))

vi.mock('@/src/graphql/client', () => ({
  getClient: () => ({
    query: () => ({
      toPromise: () => Promise.resolve({ data: { wishlistArtists: [], festivals: [] } }),
    }),
  }),
}))

describe('HomePage integration — home states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-12T15:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('(a) with no user, listUpcomingEvents is called once and HomeHero receives guest state with nearest upcoming event', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const upcomingShow1 = {
      id: 'ev-up1',
      name: 'Show Futuro 1',
      date: '2026-09-20T21:00:00-03:00',
      venue_id: 'v1',
      venues: { name: 'Niceto', city: 'CABA', country: 'AR' },
      lineups: [{ artists: { id: 'a1', name: 'Bandalos Chinos', genre: 'Indie' }, is_headliner: true }],
    }
    const upcomingShow2 = {
      id: 'ev-up2',
      name: 'Show Futuro 2',
      date: '2026-10-01T21:00:00-03:00',
      venue_id: 'v1',
      venues: { name: 'Niceto', city: 'CABA', country: 'AR' },
      lineups: [{ artists: { id: 'a2', name: 'Divididos', genre: 'Rock' }, is_headliner: true }],
    }
    vi.mocked(listUpcomingEvents).mockResolvedValue([upcomingShow1, upcomingShow2] as never)

    const element = await HomePage()
    render(element)

    expect(listUpcomingEvents).toHaveBeenCalledTimes(1)
    expect(mockHomeHero).toHaveBeenCalledWith(
      expect.objectContaining({
        state: {
          kind: 'guest',
          event: expect.objectContaining({ id: 'ev-up1' }),
        },
      })
    )
  })

  it('(b) with a user, listUpcomingEvents is not called', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('user-123')
    vi.mocked(findProfile).mockResolvedValue({ location: 'CABA' } as never)
    vi.mocked(listMyEvents).mockResolvedValue([])

    const element = await HomePage()
    render(element)

    expect(listUpcomingEvents).not.toHaveBeenCalled()
  })

  it('(c) a user with no shows gets first-time and the Tu archivo section is not rendered', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('user-123')
    vi.mocked(listMyEvents).mockResolvedValue([])

    const element = await HomePage()
    render(element)

    expect(mockHomeHero).toHaveBeenCalledWith(
      expect.objectContaining({
        state: { kind: 'first-time' },
      })
    )
    expect(screen.queryByText('Tu archivo')).toBeNull()
  })

  it('(d) went shows and nothing scheduled gives past-only and Tu archivo is rendered', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('user-123')
    const pastShow = {
      id: 'past-1',
      name: 'Show Pasado',
      date: '2025-05-10T21:00:00-03:00',
      venue_id: 'v1',
      venues: { name: 'Obras', city: 'CABA', country: 'AR' },
      lineups: [{ artists: { id: 'a1', name: 'Divididos', genre: 'Rock' }, is_headliner: true }],
      attendance: [{ id: 'att-1', status: 'went', user_id: 'user-123', rating: 5, review: null }],
    }
    vi.mocked(listMyEvents).mockResolvedValue([pastShow] as never)

    const element = await HomePage()
    render(element)

    expect(mockHomeHero).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.objectContaining({
          kind: 'past-only',
          event: expect.objectContaining({ id: 'past-1' }),
        }),
      })
    )
    expect(screen.getByText('Tu archivo')).toBeInTheDocument()
  })

  it('(e) a show dated yesterday in Argentina time without rating gives morning-after', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('user-123')
    const yesterdayShow = {
      id: 'yesterday-1',
      name: 'Show Anoche',
      date: '2026-09-11T21:00:00-03:00',
      venue_id: 'v1',
      venues: { name: 'Luna Park', city: 'CABA', country: 'AR' },
      lineups: [{ artists: { id: 'a1', name: 'Divididos', genre: 'Rock' }, is_headliner: true }],
      attendance: [{ id: 'att-y', status: 'went', user_id: 'user-123', rating: null, review: null }],
    }
    vi.mocked(listMyEvents).mockResolvedValue([yesterdayShow] as never)

    const element = await HomePage()
    render(element)

    expect(mockHomeHero).toHaveBeenCalledWith(
      expect.objectContaining({
        state: {
          kind: 'morning-after',
          event: expect.objectContaining({ id: 'yesterday-1' }),
        },
      })
    )
  })

  it('(f) wires "Lo último que viste" — HomeHero recibe los shows "went" más recientes, no una lista vacía', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('user-123')
    const wentShow = {
      id: 'went-1',
      name: 'Show Visto',
      date: '2026-09-01T21:00:00-03:00',
      venue_id: 'v1',
      venues: { name: 'Niceto', city: 'CABA', country: 'AR' },
      lineups: [{ artists: { id: 'a1', name: 'Divididos', genre: 'Rock' }, is_headliner: true }],
      attendance: [{ id: 'att-1', status: 'went', user_id: 'user-123', rating: 5, review: null }],
    }
    vi.mocked(listMyEvents).mockResolvedValue([wentShow] as never)

    const element = await HomePage()
    render(element)

    expect(mockHomeHero).toHaveBeenCalledWith(
      expect.objectContaining({
        recentSeen: [expect.objectContaining({ id: 'went-1' })],
      })
    )
  })

  it('(g) ?entrada=hoy abre el talón cuando el estado es show-today', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('user-123')
    const todayShow = {
      id: 'today-1',
      name: 'Show de esta noche',
      date: '2026-09-12T21:00:00-03:00',
      venue_id: 'v1',
      venues: { name: 'Niceto', city: 'CABA', country: 'AR' },
      lineups: [{ artists: { id: 'a1', name: 'Divididos', genre: 'Rock' }, is_headliner: true }],
      attendance: [{ id: 'att-1', status: 'going', user_id: 'user-123', rating: null, review: null }],
    }
    vi.mocked(listMyEvents).mockResolvedValue([todayShow] as never)

    const element = await HomePage({ searchParams: Promise.resolve({ entrada: 'hoy' }) })
    render(element)

    expect(mockHomeHero).toHaveBeenCalledWith(expect.objectContaining({ initialOpen: true }))
  })

  it('(h) ?entrada=hoy se ignora sin error cuando el estado no es show-today', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('user-123')
    vi.mocked(listMyEvents).mockResolvedValue([])

    const element = await HomePage({ searchParams: Promise.resolve({ entrada: 'hoy' }) })
    render(element)

    expect(mockHomeHero).toHaveBeenCalledWith(expect.objectContaining({ initialOpen: false }))
  })

  it('(i) un usuario con sesión y un show próximo muestra el skeleton de la franja de sugerencias, propia y no bloqueante (#81)', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('user-123')
    const upcomingShow = {
      id: 'ev-up1',
      name: 'Show Futuro 1',
      date: '2026-09-20T21:00:00-03:00',
      venue_id: 'v1',
      venues: { name: 'Niceto', city: 'CABA', country: 'AR' },
      lineups: [{ artists: { id: 'a1', name: 'Bandalos Chinos', genre: 'Indie' }, is_headliner: true }],
      attendance: [{ id: 'att-1', status: 'going', user_id: 'user-123', rating: null, review: null }],
    }
    vi.mocked(listMyEvents).mockResolvedValue([upcomingShow] as never)

    const element = await HomePage()
    render(element)

    expect(screen.getByRole('status', { name: /buscando shows para vos/i })).toBeInTheDocument()
  })

  it('(j) un usuario de primera vez no recibe ninguna franja de sugerencias', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('user-123')
    vi.mocked(listMyEvents).mockResolvedValue([])

    const element = await HomePage()
    render(element)

    expect(screen.queryByRole('status', { name: /buscando shows para vos/i })).toBeNull()
  })

  it('(k) sin sesión, HomeHero recibe la franja de sugerencias como ReactNode ya armado, nunca como una Promise (JD-006)', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const upcomingShow1 = {
      id: 'ev-up1',
      name: 'Show Futuro 1',
      date: '2026-09-20T21:00:00-03:00',
      venue_id: 'v1',
      venues: { name: 'Niceto', city: 'CABA', country: 'AR' },
      lineups: [{ artists: { id: 'a1', name: 'Bandalos Chinos', genre: 'Indie' }, is_headliner: true }],
    }
    vi.mocked(listUpcomingEvents).mockResolvedValue([upcomingShow1] as never)

    const element = await HomePage()
    render(element)

    const guestCall = mockHomeHero.mock.calls.find(([props]) => props.state.kind === 'guest')
    expect(guestCall).toBeTruthy()
    const [props] = guestCall!
    expect(props.suggestions).toBeTruthy()
    expect(props.suggestions instanceof Promise).toBe(false)
  })

  it('(l) primera vez: getFirstTimeSeeds arranca para el usuario y HomeHero recibe `seeds` como Promise, nunca ya resuelta (issue #81)', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('user-123')
    vi.mocked(listMyEvents).mockResolvedValue([])

    const element = await HomePage()
    render(element)

    expect(getFirstTimeSeeds).toHaveBeenCalledWith('user-123')
    const [props] = mockHomeHero.mock.calls[0]
    expect(props.seeds).toBeTruthy()
    expect(props.seeds instanceof Promise).toBe(true)
  })

  it('(m) fuera de primera vez, getFirstTimeSeeds nunca se llama', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue('user-123')
    const wentShow = {
      id: 'went-1',
      name: 'Show Visto',
      date: '2026-09-01T21:00:00-03:00',
      venue_id: 'v1',
      venues: { name: 'Niceto', city: 'CABA', country: 'AR' },
      lineups: [{ artists: { id: 'a1', name: 'Divididos', genre: 'Rock' }, is_headliner: true }],
      attendance: [{ id: 'att-1', status: 'went', user_id: 'user-123', rating: 5, review: null }],
    }
    vi.mocked(listMyEvents).mockResolvedValue([wentShow] as never)

    const element = await HomePage()
    render(element)

    expect(getFirstTimeSeeds).not.toHaveBeenCalled()
  })
})
