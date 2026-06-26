import { cache } from 'react'
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

/**
 * Cifras del historial del usuario actual: totales, rankings y series por
 * año. Envuelto en `cache()` de React por precaución, no porque hoy haga
 * falta: ningún llamador actual la invoca dos veces en la misma request
 * (`/profile` la pide una sola vez, en un `Promise.all` de arriba de todo).
 * Es el mismo criterio que `listMyEvents` en D-7 de coleccion-mobile, donde
 * sí había dos árboles llamándola por separado — acá queda por si algún
 * componente futuro la vuelve a pedir dentro de la misma request. La
 * memoización es por request: nunca cruza sesiones.
 */
export const getStats = cache(async function getStats(): Promise<StatsData> {
    return getPersonalStats()
})
