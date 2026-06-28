// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProfileHubGrid } from '@/src/domains/auth/components/ProfileHubGrid'
import type { ProfileHubCellData } from '@/src/domains/auth/profile-hub-view'

const CELLS: readonly [ProfileHubCellData, ProfileHubCellData, ProfileHubCellData, ProfileHubCellData] = [
    { value: '23', caption: 'este año', href: '/stats' },
    { value: '$412k', caption: 'gastos', href: '/expenses', tone: 'acento' },
    { value: '38', caption: 'colección', href: '/coleccion' },
    { value: '2026', caption: 'wrapped', href: '/wrapped' },
]

describe('ProfileHubGrid', () => {
    it('renderiza exactamente 4 <li>, semántica de lista igual que coleccion/page.tsx:229 (D-7)', () => {
        render(<ProfileHubGrid cells={CELLS} />)
        expect(screen.getAllByRole('listitem')).toHaveLength(4)
    })

    it('cada celda linkea a su href, con value y caption visibles', () => {
        render(<ProfileHubGrid cells={CELLS} />)

        expect(screen.getByRole('link', { name: /23[\s\S]*este año/ })).toHaveAttribute('href', '/stats')
        expect(screen.getByRole('link', { name: /\$412k[\s\S]*gastos/ })).toHaveAttribute('href', '/expenses')
        expect(screen.getByRole('link', { name: /38[\s\S]*colección/ })).toHaveAttribute('href', '/coleccion')
        expect(screen.getByRole('link', { name: /2026[\s\S]*wrapped/ })).toHaveAttribute('href', '/wrapped')
    })

    it('mantiene el orden este año/gastos/colección/wrapped', () => {
        render(<ProfileHubGrid cells={CELLS} />)
        const links = screen.getAllByRole('link')
        expect(links.map((l) => l.textContent)).toEqual([
            expect.stringContaining('este año'),
            expect.stringContaining('gastos'),
            expect.stringContaining('colección'),
            expect.stringContaining('wrapped'),
        ])
    })
})
