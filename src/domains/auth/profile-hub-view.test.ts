import { describe, it, expect } from 'vitest'
import { buildProfileHub, compactArs } from '@/src/domains/auth/profile-hub-view'
import type { ProfileHubInput } from '@/src/domains/auth/profile-hub-view'
import { routes } from '@/src/core/lib/routes'

const BASE_INPUT: ProfileHubInput = {
    fullName: 'Malena Costa',
    email: 'malena@example.com',
    avatarUrl: null,
    memberSince: '2011-03-04T00:00:00.000Z',
    showsAttended: 147,
    uniqueArtists: 38,
    yearShows: 23,
    yearSpend: 412000,
    year: 2026,
}

describe('compactArs', () => {
    it('compacta a miles con sufijo k cuando supera los 999', () => {
        expect(compactArs(412000)).toBe('$412k')
    })

    it('deja el monto tal cual, sin sufijo, cuando es menor a 1000', () => {
        expect(compactArs(900)).toBe('$900')
    })

    it('formatea cero sin signo negativo ni sufijo', () => {
        expect(compactArs(0)).toBe('$0')
    })
})

describe('buildProfileHub', () => {
    it('arma el eyebrow "Vos · desde {año}" a partir de memberSince', () => {
        const view = buildProfileHub(BASE_INPUT)
        expect(view.eyebrow).toBe('Vos · desde 2011')
    })

    it('usa el año de fallback cuando memberSince es null', () => {
        const view = buildProfileHub({ ...BASE_INPUT, memberSince: null })
        expect(view.eyebrow).toBe('Vos · desde 2026')
    })

    it('prioriza full_name para el displayName', () => {
        const view = buildProfileHub(BASE_INPUT)
        expect(view.displayName).toBe('Malena Costa')
    })

    it('cae al local-part del email cuando no hay full_name', () => {
        const view = buildProfileHub({ ...BASE_INPUT, fullName: null })
        expect(view.displayName).toBe('malena')
    })

    it('cae a "Sin nombre" cuando no hay full_name ni email', () => {
        const view = buildProfileHub({ ...BASE_INPUT, fullName: null, email: null })
        expect(view.displayName).toBe('Sin nombre')
    })

    it('arma el monograma con las iniciales de nombre y apellido', () => {
        const view = buildProfileHub(BASE_INPUT)
        expect(view.monogram).toBe('MC')
    })

    it('arma la statsLine "{shows} shows · {N} artistas"', () => {
        const view = buildProfileHub(BASE_INPUT)
        expect(view.statsLine).toBe('147 shows · 38 artistas')
    })

    it('devuelve avatarUrl tal cual viene del input', () => {
        const view = buildProfileHub({ ...BASE_INPUT, avatarUrl: 'https://cdn.test/a.png' })
        expect(view.avatarUrl).toBe('https://cdn.test/a.png')
    })

    it('arma las 4 celdas en el orden este año/gastos/colección/wrapped, con destinos y tonos correctos', () => {
        const view = buildProfileHub(BASE_INPUT)

        expect(view.cells).toEqual([
            { value: '23', caption: 'este año', href: routes.stats },
            { value: '$412k', caption: 'gastos', href: routes.expenses.list, tone: 'acento' },
            { value: '38', caption: 'colección', href: routes.collection },
            { value: '2026', caption: 'wrapped', href: routes.wrapped },
        ])
    })
})
