import type { StatsData } from './data'

/**
 * Pura, sin I/O — mismo criterio que aggregate.ts. Deriva de datos que
 * `getPersonalStats` ya calcula, no agrega ninguna tabla de tracking nueva
 * (issue #61): un logro es sólo una lectura distinta de números que ya
 * existen, nunca un estado que haya que persistir o mantener sincronizado.
 *
 * Ningún logro pide un dato que el usuario no haya cargado ya como parte
 * del uso normal — no hay ninguno atado a `rainyShows`: ese campo siempre
 * da 0 hoy porque `getPersonalStats` todavía no resuelve clima por evento
 * (ver el comentario en `data.ts`), así que un logro basado en eso sería
 * un logro que nadie puede desbloquear nunca, no una meta real.
 */
export interface Achievement {
    id: string
    label: string
    description: string
    unlocked: boolean
}

export function computeAchievements(stats: StatsData): Achievement[] {
    const topArtistCount = stats.topArtists[0]?.count ?? 0

    return [
        {
            id: 'primer-talon',
            label: 'Primer talón',
            description: 'Marcá tu primer show como "Fui"',
            unlocked: stats.showsAttended >= 1,
        },
        {
            id: 'diez-rituales',
            label: 'Diez rituales',
            description: '10 shows en tu archivo',
            unlocked: stats.showsAttended >= 10,
        },
        {
            id: 'veinticinco-rituales',
            label: 'Veinticinco rituales',
            description: '25 shows en tu archivo',
            unlocked: stats.showsAttended >= 25,
        },
        {
            id: 'explorador',
            label: 'Explorador',
            description: '5 sedes distintas',
            unlocked: stats.uniqueVenues >= 5,
        },
        {
            id: 'multi-ciudad',
            label: 'Multi-ciudad',
            description: '3 ciudades distintas',
            unlocked: stats.uniqueCities.length >= 3,
        },
        {
            id: 'trotamundos',
            label: 'Trotamundos',
            description: 'Shows en 2 países distintos',
            unlocked: stats.uniqueCountries.length >= 2,
        },
        {
            id: 'fan-fiel',
            label: 'Fan fiel',
            description: 'Viste al mismo artista 3 veces',
            unlocked: topArtistCount >= 3,
        },
        {
            id: 'critico',
            label: 'Crítico',
            description: 'Calificaste 10 shows',
            unlocked: stats.totalRated >= 10,
        },
    ]
}
