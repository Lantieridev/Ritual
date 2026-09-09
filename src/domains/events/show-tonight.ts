import { daysUntil, hasTimeOfDay, eventTimeOfDay } from '@/src/core/lib/dates'
import { routes } from '@/src/core/lib/routes'
import type { MobileBandaLink } from '@/src/core/components/layout/MobileAction'

/**
 * Fila de `attendance` ya acotada por la query (user_id, status='going') —
 * ver getShowTonight en data.ts. `events` viene null cuando la fila está
 * huérfana (evento borrado) — se descarta, no se lanza.
 */
export interface ShowTonightRow {
  status: string
  events: {
    id: string
    name: string | null
    date: string
    lineups: Array<{ artists: { name: string } }> | null
  } | null
}

export interface ShowTonight {
  id: string
  headliner: string
  date: string
}

/**
 * Selección pura del show de "esta noche" (issue #82): filtra al día
 * calendario en Argentina (mismo criterio que buildHomeHeroState, vía
 * daysUntil) y, si hay más de uno, gana el más temprano. Filas malformadas
 * (sin evento, o con una fecha que no es un string) se descartan en vez de
 * tirar — la banda de entrada no puede romper el layout raíz por un dato
 * sucio (R1-002).
 */
export function pickShowTonight(rows: ShowTonightRow[], now: Date = new Date()): ShowTonight | null {
  let best: ShowTonight | null = null
  for (const row of rows) {
    const event = row.events
    if (!event || typeof event.date !== 'string') continue
    if (daysUntil(event.date, now) !== 0) continue

    const headliner = event.lineups?.[0]?.artists.name ?? event.name ?? 'Recital'
    if (!best || event.date < best.date) {
      best = { id: event.id, headliner, date: event.date }
    }
  }
  return best
}

/**
 * El link server-safe de la banda de "Tu entrada de hoy" (R1-004/R1-007):
 * siempre navega a `routes.tonightTicket`, nunca lleva una función. La hora
 * sólo se agrega cuando la fecha guardada la trae (`hasTimeOfDay`).
 */
export function bandaLinkFor(show: ShowTonight): MobileBandaLink {
  const time = hasTimeOfDay(show.date) ? ` · ${eventTimeOfDay(show.date)}` : ''
  return {
    subtitle: 'Tu entrada de hoy',
    title: `${show.headliner}${time}`,
    actionLabel: 'Abrir',
    href: routes.tonightTicket,
  }
}
