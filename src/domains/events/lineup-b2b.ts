import crypto from 'crypto'
import type { LineupRow } from '@/src/core/types'

/**
 * Pura, sin I/O — mismo criterio que debts.ts/aggregate.ts. Issue #56: arma
 * las filas a insertar en `lineups` a partir de la lista plana de artistas
 * del form más los grupos B2B que el usuario haya marcado, generando un
 * `b2b_group` (uuid) fresco por cada grupo real.
 */
export interface LineupRowToInsert {
  artist_id: string
  b2b_group: string | null
}

/**
 * `b2bGroups` es una lista de sub-listas de artist_id ("estos van juntos en
 * B2B"). Reglas, todas silenciosas en vez de tirar error — un grupo mal
 * formado no debería bloquear guardar el resto de un lineup válido:
 *  - un grupo con menos de 2 artistas no es un B2B, se ignora.
 *  - un artist_id de un grupo que no está en `artistIds` se ignora (no se
 *    inventa una fila de lineup que el usuario no pidió).
 *  - un artist_id que aparece en más de un grupo se queda con el primero
 *    -no tiene sentido estar en dos B2B a la vez en el mismo slot.
 */
export function buildLineupRows(
  artistIds: string[],
  b2bGroups: string[][] = []
): LineupRowToInsert[] {
  const groupIdByArtist = new Map<string, string>()
  const validArtistIds = new Set(artistIds)

  for (const group of b2bGroups) {
    const members = group.filter((id) => validArtistIds.has(id) && !groupIdByArtist.has(id))
    if (members.length < 2) continue

    const groupId = crypto.randomUUID()
    for (const id of members) groupIdByArtist.set(id, groupId)
  }

  return artistIds.map((artist_id) => ({
    artist_id,
    b2b_group: groupIdByArtist.get(artist_id) ?? null,
  }))
}

/** Un slot del lineup para mostrar: 1 artista solo, o 2+ en B2B. */
export interface LineupDisplayGroup {
  artists: LineupRow['artists'][]
}

/**
 * Agrupa las filas planas de `lineups` en slots para la ficha del evento —
 * filas con el mismo `b2b_group` se muestran como un único "Artista A B2B
 * Artista B" en vez de dos entradas sueltas. Conserva el orden de primera
 * aparición: un grupo se arma completo la primera vez que aparece cualquiera
 * de sus miembros, así una fila solista entre medio de dos miembros de un
 * grupo no se reordena rara.
 */
export function groupLineupForDisplay(lineups: LineupRow[]): LineupDisplayGroup[] {
  const groups: LineupDisplayGroup[] = []
  const emittedGroupIds = new Set<string>()

  for (const row of lineups) {
    if (row.b2b_group) {
      if (emittedGroupIds.has(row.b2b_group)) continue
      emittedGroupIds.add(row.b2b_group)
      const members = lineups.filter((r) => r.b2b_group === row.b2b_group).map((r) => r.artists)
      groups.push({ artists: members })
    } else {
      groups.push({ artists: [row.artists] })
    }
  }

  return groups
}
