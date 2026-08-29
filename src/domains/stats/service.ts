import { getPersonalStats } from './data'
import type { StatsData } from './data'

export type { StatsData }

/**
 * Capa de casos de uso del dominio de stats.
 *
 * Era el único dominio junto a `auth` que todavía no tenía este seam: las
 * páginas de Números y Wrapped, y el resolver de GraphQL, importaban
 * `data.ts` directo. Se agrega para que la regla —declarada en `src/README.md`
 * desde el issue #25— valga también acá y no queden dos dominios como
 * excepción silenciosa.
 *
 * No hay lado de escritura: las estadísticas se derivan de `attendance` y
 * `expenses`, nunca se editan.
 */

/** Cifras del historial del usuario actual: totales, rankings y series por año. */
export async function getStats(): Promise<StatsData> {
    return getPersonalStats()
}
