// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { redirect } from 'next/navigation'
import ProfilePage from '@/app/profile/page'
import { findProfile } from '@/src/domains/auth/service'
import { listMyEvents } from '@/src/domains/events/service'
import { getStats } from '@/src/domains/stats/service'
import { summarizeExpenses } from '@/src/domains/expenses/service'
import type { EventWithAttendance } from '@/src/domains/events/service'
import type { StatsData } from '@/src/domains/stats/service'
import type { ExpenseSummary } from '@/src/domains/expenses/service'
import type { Profile } from '@/src/core/types'

const mockGetUser = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
    createClient: async () => ({ auth: { getUser: () => mockGetUser() } }),
}))

vi.mock('@/src/domains/auth/service', () => ({
    findProfile: vi.fn(),
}))

vi.mock('@/src/domains/events/service', () => ({
    listMyEvents: vi.fn(),
}))

vi.mock('@/src/domains/stats/service', () => ({
    getStats: vi.fn(),
}))

vi.mock('@/src/domains/expenses/service', () => ({
    summarizeExpenses: vi.fn(),
}))

vi.mock('@/src/core/auth/actions', () => ({
    signout: vi.fn(),
}))

vi.mock('next/navigation', () => ({
    redirect: vi.fn(() => {
        throw new Error('NEXT_REDIRECT')
    }),
}))

const CURRENT_YEAR = new Date().getFullYear()

const BASE_PROFILE: Profile = {
    id: 'u1',
    username: 'malecosta',
    full_name: 'Malena Costa',
    avatar_url: null,
    website: null,
    bio: null,
    location: null,
}

const BASE_USER = {
    id: 'u1',
    email: 'malena@example.com',
    created_at: '2011-03-04T00:00:00.000Z',
}

function wentEvent(id: string): EventWithAttendance {
    return {
        id,
        name: null,
        date: '2020-01-01',
        venue_id: null,
        venues: null,
        lineups: null,
        attendance: [{ id: `att-${id}`, status: 'went', user_id: 'u1', rating: null, review: null }],
    } as unknown as EventWithAttendance
}

const BASE_STATS = { showsByYear: { [String(CURRENT_YEAR)]: 23 }, uniqueArtists: 38 } as unknown as StatsData
const BASE_EXPENSES = { byYear: { [String(CURRENT_YEAR)]: 412000 } } as unknown as ExpenseSummary

type ElementWithChildren = ReactElement<{ 'data-testid'?: string; className?: string; children?: ReactNode }>

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

describe('ProfilePage — auth guard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('redirige a /login sin usuario autenticado, sin renderizar ningún árbol', async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } })

        await expect(ProfilePage()).rejects.toThrow('NEXT_REDIRECT')

        expect(redirect).toHaveBeenCalledWith('/login')
        expect(findProfile).not.toHaveBeenCalled()
    })
})

describe('ProfilePage — árboles mobile/desktop', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetUser.mockResolvedValue({ data: { user: BASE_USER } })
        vi.mocked(findProfile).mockResolvedValue(BASE_PROFILE)
        vi.mocked(listMyEvents).mockResolvedValue([wentEvent('ev1')])
        vi.mocked(getStats).mockResolvedValue(BASE_STATS)
        vi.mocked(summarizeExpenses).mockResolvedValue(BASE_EXPENSES)
    })

    it('renderiza los dos testids, perfil-mobile con md:hidden y perfil-desktop con hidden md:block', async () => {
        const element = await ProfilePage()

        const mobile = findByTestId(element, 'perfil-mobile')
        const desktop = findByTestId(element, 'perfil-desktop')

        expect(mobile).not.toBeNull()
        expect(mobile!.props.className).toMatch(/md:hidden/)
        expect(desktop).not.toBeNull()
        expect(desktop!.props.className).toMatch(/hidden md:block/)
    })

    it('el árbol de escritorio conserva su contenido intacto (D-6/desktop non-regression)', async () => {
        const element = await ProfilePage()
        render(element)

        const desktop = within(screen.getByTestId('perfil-desktop'))
        expect(desktop.getByText('Socio Ritual')).toBeInTheDocument()
        expect(desktop.getByText('Malena Costa')).toBeInTheDocument()
        expect(desktop.getByText('@malecosta')).toBeInTheDocument()
        expect(desktop.getByRole('link', { name: 'Ver mi agenda' })).toBeInTheDocument()
        expect(desktop.getByRole('link', { name: 'Editar carnet' })).toBeInTheDocument()
        expect(desktop.getByText('malena@example.com')).toBeInTheDocument()
    })

    it('el hub mobile muestra el header con los datos reales', async () => {
        const element = await ProfilePage()
        render(element)

        const mobile = within(screen.getByTestId('perfil-mobile'))
        expect(mobile.getByText(`Vos · desde 2011`)).toBeInTheDocument()
        expect(mobile.getByText('Malena Costa')).toBeInTheDocument()
        expect(mobile.getByText('1 shows · 38 artistas')).toBeInTheDocument()
    })

    it('el grid mobile muestra las 4 celdas con los valores reales de getStats/summarizeExpenses', async () => {
        const element = await ProfilePage()
        render(element)

        const mobile = within(screen.getByTestId('perfil-mobile'))
        expect(mobile.getByRole('link', { name: /23[\s\S]*este año/ })).toHaveAttribute('href', '/stats')
        expect(mobile.getByRole('link', { name: /\$412k[\s\S]*gastos/ })).toHaveAttribute('href', '/expenses')
        expect(mobile.getByRole('link', { name: /38[\s\S]*colección/ })).toHaveAttribute('href', '/coleccion')
        expect(mobile.getByRole('link', { name: new RegExp(`${CURRENT_YEAR}[\\s\\S]*wrapped`) })).toHaveAttribute('href', '/wrapped')
    })

    it('llama a getStats y summarizeExpenses(user.id) exactamente una vez cada uno', async () => {
        await ProfilePage()

        expect(getStats).toHaveBeenCalledTimes(1)
        expect(summarizeExpenses).toHaveBeenCalledWith('u1')
        expect(summarizeExpenses).toHaveBeenCalledTimes(1)
    })

    it('la action de PageShell envuelve a SignOutButton en hidden md:flex, para no duplicar el logout en mobile', async () => {
        const element = await ProfilePage()
        const props = (element as ReactElement<{ action?: ReactElement<{ className?: string }> }>).props
        expect(props.action?.props.className).toBe('hidden md:flex')
    })
})
