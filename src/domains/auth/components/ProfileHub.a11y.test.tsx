// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileHubHeader } from '@/src/domains/auth/components/ProfileHubHeader'
import { ProfileHubGrid } from '@/src/domains/auth/components/ProfileHubGrid'
import type { ProfileHubCellData } from '@/src/domains/auth/profile-hub-view'

vi.mock('@/src/core/auth/actions', () => ({
    signout: vi.fn(),
}))

const HEADER_PROPS = {
    eyebrow: 'Vos · desde 2011',
    displayName: 'Malena Costa',
    monogram: 'MC',
    avatarUrl: null,
    statsLine: '147 shows · 38 artistas',
}

const CELLS: readonly [ProfileHubCellData, ProfileHubCellData, ProfileHubCellData, ProfileHubCellData] = [
    { value: '23', caption: 'este año', href: '/stats' },
    { value: '$412k', caption: 'gastos', href: '/expenses', tone: 'acento' },
    { value: '38', caption: 'colección', href: '/coleccion' },
    { value: '2026', caption: 'wrapped', href: '/wrapped' },
]

function checkAccessibleNames(container: HTMLElement) {
    const interactiveElements = container.querySelectorAll('a, button')
    expect(interactiveElements.length).toBeGreaterThan(0)

    for (const el of Array.from(interactiveElements)) {
        const ariaLabel = el.getAttribute('aria-label')
        const text = el.textContent?.trim()
        const accessibleName = ariaLabel || text || ''
        expect(accessibleName.length).toBeGreaterThan(0)
    }
}

function checkNoPositiveTabIndex(container: HTMLElement) {
    const elementsWithTabIndex = container.querySelectorAll('[tabindex]')
    for (const el of Array.from(elementsWithTabIndex)) {
        const val = parseInt(el.getAttribute('tabindex') || '0', 10)
        expect(val).toBeLessThanOrEqual(0)
    }
}

describe('ProfileHubGrid — accesibilidad', () => {
    it('todos los links tienen nombre accesible no vacío', () => {
        const { container } = render(<ProfileHubGrid cells={CELLS} />)
        checkAccessibleNames(container)
    })

    it('no contiene ningún tabindex positivo', () => {
        const { container } = render(<ProfileHubGrid cells={CELLS} />)
        checkNoPositiveTabIndex(container)
    })

    it('cada celda declara el alto mínimo tappable de 104px', () => {
        render(<ProfileHubGrid cells={CELLS} />)
        for (const link of screen.getAllByRole('link')) {
            expect(link).toHaveClass('min-h-[104px]')
        }
    })
})

describe('ProfileHubHeader — accesibilidad', () => {
    it('el trigger "···" tiene nombre accesible y ≥44px de alto / ≥48px de ancho', () => {
        render(<ProfileHubHeader {...HEADER_PROPS} />)

        const trigger = screen.getByRole('button', { name: /ajustes/i })
        expect(trigger.textContent?.trim().length || trigger.getAttribute('aria-label')?.trim().length).toBeTruthy()
        expect(trigger).toHaveClass('min-h-[44px]')
        expect(trigger).toHaveClass('min-w-[48px]')
    })

    it('todos los links y botones del sheet abierto tienen nombre accesible no vacío', async () => {
        const user = userEvent.setup()
        const { container } = render(<ProfileHubHeader {...HEADER_PROPS} />)

        await user.click(screen.getByRole('button', { name: /ajustes/i }))

        checkAccessibleNames(container)
    })

    it('no contiene ningún tabindex positivo, con el sheet abierto', async () => {
        const user = userEvent.setup()
        const { container } = render(<ProfileHubHeader {...HEADER_PROPS} />)

        await user.click(screen.getByRole('button', { name: /ajustes/i }))

        checkNoPositiveTabIndex(container)
    })
})
