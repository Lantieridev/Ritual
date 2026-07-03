import { routes } from '@/src/core/lib/routes'

/**
 * Datos crudos para armar la vista de "Vos" (hub mobile de /profile) — sin
 * I/O: la página resuelve `findProfile`/`getStats`/`summarizeExpenses` y le
 * pasa acá los números ya calculados.
 */
export interface ProfileHubInput {
    fullName: string | null
    email: string | null
    avatarUrl: string | null
    /** `user.created_at` (ISO) — `profiles` no tiene columna `created_at`. */
    memberSince: string | null
    showsAttended: number
    uniqueArtists: number
    yearShows: number
    yearSpend: number
    year: number
}

export interface ProfileHubCellData {
    value: string
    caption: string
    href: string
    tone?: 'acento'
}

export interface ProfileHubView {
    /** `Vos · desde {año}` */
    eyebrow: string
    displayName: string
    /** 2 caracteres, mayúsculas — mismo criterio que app/profile/page.tsx. */
    monogram: string
    avatarUrl: string | null
    /** `{shows} shows · {N} artistas` */
    statsLine: string
    cells: readonly [ProfileHubCellData, ProfileHubCellData, ProfileHubCellData, ProfileHubCellData]
}

/** 2 caracteres en mayúscula — misma regla que la función `monogram` de app/profile/page.tsx. */
function buildMonogram(name: string | null, fallbackSeed: string): string {
    const source = name?.trim() || fallbackSeed
    const parts = source.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return source.slice(0, 2).toUpperCase()
}

/**
 * Compacta un monto en pesos a la notación corta del prototipo: por debajo
 * de los mil queda tal cual (`900 → '$900'`), de ahí en más se redondea a
 * miles (`412000 → '$412k'`). Sin decimales — el prototipo nunca los usa.
 */
export function compactArs(amount: number): string {
    const safeAmount = Math.max(0, Math.round(amount))
    if (safeAmount < 1000) return `$${safeAmount}`
    return `$${Math.round(safeAmount / 1000)}k`
}

/** Vista pura del hub de "Vos" — la arma la página, la consumen ProfileHubHeader/Grid. */
export function buildProfileHub(input: ProfileHubInput): ProfileHubView {
    const emailLocalPart = input.email?.split('@')[0] ?? null
    const displayName = input.fullName?.trim() || emailLocalPart || 'Sin nombre'
    const monogram = buildMonogram(input.fullName, input.email?.[0] ?? '?')

    const memberSinceYear = input.memberSince ? new Date(input.memberSince).getFullYear() : input.year
    const eyebrow = `Vos · desde ${memberSinceYear}`
    const statsLine = `${input.showsAttended} shows · ${input.uniqueArtists} artistas`

    const cells: ProfileHubView['cells'] = [
        { value: String(input.yearShows), caption: 'este año', href: routes.stats },
        { value: compactArs(input.yearSpend), caption: 'gastos', href: routes.expenses.list, tone: 'acento' },
        { value: String(input.uniqueArtists), caption: 'colección', href: routes.collection },
        { value: String(input.year), caption: 'wrapped', href: routes.wrapped },
    ]

    return {
        eyebrow,
        displayName,
        monogram,
        avatarUrl: input.avatarUrl,
        statsLine,
        cells,
    }
}
