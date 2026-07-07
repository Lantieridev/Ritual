import { daysUntil, eventYear, toDateOnly } from '@/src/core/lib/dates'
import { routes } from '@/src/core/lib/routes'
import type { EventWithAttendance } from '@/src/domains/events/service'

export interface DiaryRow {
  id: string
  /** Headliner del lineup, con el nombre del evento como fallback (D-3). */
  name: string
  /** `null` cuando el show no tiene sede — el segmento se omite, nunca "Sin sede". */
  venue: string | null
  year: number
  /** 1–5. `null` = sin puntuar: no se dibuja nada, ni un placeholder. */
  rating: number | null
  href: string
}

export type CollectionView = 'grilla' | 'lista'

/**
 * Un 'went' fechado en el futuro es dato inconsistente, no un show visto
 * (mismo criterio que `pickRecentSeen` en home-view.ts). Sin tope: la
 * colección entera.
 */
export function buildCollectionDiary(
  myEvents: EventWithAttendance[],
  now: Date = new Date()
): DiaryRow[] {
  return myEvents
    .filter((ev) => ev.attendance?.[0]?.status === 'went' && daysUntil(ev.date, now) <= 0)
    .sort((a, b) => (toDateOnly(b.date) < toDateOnly(a.date) ? -1 : toDateOnly(b.date) > toDateOnly(a.date) ? 1 : 0))
    .map((ev) => ({
      id: ev.id,
      // Chain inlined a propósito (D-3): ya está duplicada 3× en el
      // dominio (HomeHeroStates.tsx, show-tonight.ts, recommendations/candidates.ts),
      // y extraer un helper compartido queda fuera del alcance de este cambio.
      name: ev.lineups?.[0]?.artists.name ?? ev.name ?? 'Recital',
      venue: ev.venues?.name ?? null,
      year: eventYear(ev.date),
      rating: ev.attendance?.[0]?.rating ?? null,
      href: routes.events.detail(ev.id),
    }))
}

/** `"147 shows · 2011 → hoy"`, `"1 show · 2011 → hoy"`, `null` si no hay filas. */
export function diaryHeadline(rows: DiaryRow[]): string | null {
  if (rows.length === 0) return null
  const minYear = rows.reduce((min, row) => Math.min(min, row.year), rows[0].year)
  const label = rows.length === 1 ? 'show' : 'shows'
  return `${rows.length} ${label} · ${minYear} → hoy`
}

/** Grilla es el default: su href omite el param (canónico `/coleccion`). */
export function coleccionHref(view: CollectionView): string {
  return view === 'lista' ? `${routes.collection}?vista=lista` : routes.collection
}

/** Comparación estricta con `'lista'`; cualquier otra cosa cae a `'grilla'` (R1-007). */
export function parseCollectionView(raw: string | string[] | undefined): CollectionView {
  return raw === 'lista' ? 'lista' : 'grilla'
}
