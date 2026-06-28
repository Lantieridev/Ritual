// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileHubHeader } from '@/src/domains/auth/components/ProfileHubHeader'
import { signout } from '@/src/core/auth/actions'

vi.mock('@/src/core/auth/actions', () => ({
    signout: vi.fn(),
}))

const BASE_PROPS = {
    eyebrow: 'Vos · desde 2011',
    displayName: 'Malena Costa',
    monogram: 'MC',
    statsLine: '147 shows · 38 artistas',
}

describe('ProfileHubHeader — identidad', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('muestra el eyebrow, el nombre y la statsLine', () => {
        render(<ProfileHubHeader {...BASE_PROPS} avatarUrl={null} />)

        expect(screen.getByText('Vos · desde 2011')).toBeInTheDocument()
        expect(screen.getByText('Malena Costa')).toBeInTheDocument()
        expect(screen.getByText('147 shows · 38 artistas')).toBeInTheDocument()
    })

    it('con avatarUrl, renderiza la foto real (no el monograma)', () => {
        const { container } = render(<ProfileHubHeader {...BASE_PROPS} avatarUrl="https://cdn.test/avatar.png" />)

        const img = container.querySelector('img')
        expect(img).not.toBeNull()
        expect(img).toHaveAttribute('src', 'https://cdn.test/avatar.png')
        expect(screen.queryByText('MC')).not.toBeInTheDocument()
    })

    it('con avatarUrl null, cae al monograma (camino común, no la excepción)', () => {
        const { container } = render(<ProfileHubHeader {...BASE_PROPS} avatarUrl={null} />)

        expect(container.querySelector('img')).toBeNull()
        expect(screen.getByText('MC')).toBeInTheDocument()
    })
})

describe('ProfileHubHeader — sheet "Tu cuenta"', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('el sheet no está abierto hasta que se activa el trigger "···"', () => {
        render(<ProfileHubHeader {...BASE_PROPS} avatarUrl={null} />)
        expect(screen.queryByText('Tu cuenta')).not.toBeInTheDocument()
    })

    it('"···" abre el sheet con título "Tu cuenta" y subtítulo "Ajustes y datos"', async () => {
        const user = userEvent.setup()
        render(<ProfileHubHeader {...BASE_PROPS} avatarUrl={null} />)

        await user.click(screen.getByRole('button', { name: /···|ajustes/i }))

        expect(screen.getByText('Tu cuenta')).toBeInTheDocument()
        expect(screen.getByText('Ajustes y datos')).toBeInTheDocument()
    })

    it('muestra los 5 items en el orden y con los destinos exactos de la spec', async () => {
        const user = userEvent.setup()
        render(<ProfileHubHeader {...BASE_PROPS} avatarUrl={null} />)
        await user.click(screen.getByRole('button', { name: /···|ajustes/i }))

        const dialog = within(screen.getByRole('dialog'))
        const links = dialog.getAllByRole('link')
        const labels = links.map((l) => l.textContent)

        expect(labels[0]).toContain('Editar perfil')
        expect(links[0]).toHaveAttribute('href', '/profile/edit')

        expect(labels[1]).toContain('Números')
        expect(links[1]).toHaveAttribute('href', '/stats')

        expect(labels[2]).toContain('Gastos')
        expect(links[2]).toHaveAttribute('href', '/expenses')

        expect(labels[3]).toContain('Wrapped')
        expect(links[3]).toHaveAttribute('href', '/wrapped')

        // "Cerrar sesión" es un <button onClick>, no un link — se prueba aparte.
        expect(dialog.getByRole('button', { name: /Cerrar sesión/i })).toBeInTheDocument()
    })

    it('el hint de "Gastos" nunca contiene una cifra', async () => {
        const user = userEvent.setup()
        render(<ProfileHubHeader {...BASE_PROPS} avatarUrl={null} />)
        await user.click(screen.getByRole('button', { name: /···|ajustes/i }))

        const gastosLink = screen.getByRole('link', { name: /Gastos/i })
        expect(gastosLink.textContent).not.toMatch(/\d/)
    })

    it('"Wrapped" tiene tone="acento" (rojo)', async () => {
        const user = userEvent.setup()
        render(<ProfileHubHeader {...BASE_PROPS} avatarUrl={null} />)
        await user.click(screen.getByRole('button', { name: /···|ajustes/i }))

        const wrappedLink = screen.getByRole('link', { name: /Wrapped/i })
        expect(within(wrappedLink).getByText('Wrapped')).toHaveClass('text-ritual-red')
    })

    it('"Cerrar sesión" tiene tone="apagado" (gris) y llama a signout() exactamente una vez', async () => {
        const user = userEvent.setup()
        render(<ProfileHubHeader {...BASE_PROPS} avatarUrl={null} />)
        await user.click(screen.getByRole('button', { name: /···|ajustes/i }))

        const cerrarButton = screen.getByRole('button', { name: /Cerrar sesión/i })
        expect(within(cerrarButton).getByText('Cerrar sesión')).toHaveClass('text-ritual-gray-text')

        await user.click(cerrarButton)

        expect(vi.mocked(signout)).toHaveBeenCalledTimes(1)
    })
})
