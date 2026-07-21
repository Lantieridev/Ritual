import Link from 'next/link'
import type { SearchRow } from '@/src/domains/search/rows'

export interface SearchRowListProps {
  rows: SearchRow[]
}

const KIND_TAG: Record<SearchRow['kind'], string> = {
  event: 'Evento',
  artist: 'Artista',
  venue: 'Sede',
  festival: 'Festival',
}

/** "A N KM" reemplaza el tag de tipo sólo cuando la fila viene de `searchNearby` — nunca al revés (D-6 del design.md: festivales/artistas jamás llevan distancia). */
function rowTag(row: SearchRow): string {
  if (row.distanceKm != null) return `A ${Math.round(row.distanceKm)} KM`
  return KIND_TAG[row.kind]
}

/** Fila densa de resultado (Requirement "Dense entity row") — 64px, thumb 52x52, no reusa `EventCard`. */
export function SearchRowList({ rows }: SearchRowListProps) {
  return (
    <ul role="list" className="divide-y divide-ritual-surface-high">
      {rows.map((row) => (
        <li key={`${row.kind}-${row.id}`}>
          <Link href={row.href} className="flex items-center gap-[13px] py-[13px] min-h-[64px]">
            <span aria-hidden="true" className="w-[52px] h-[52px] flex-none ritual-photo-fallback" />
            <span className="flex-1 min-w-0">
              <span className="block font-subtitle font-black text-[22px] uppercase leading-none text-ritual-bone truncate">
                {row.title}
              </span>
              {row.meta && (
                <span className="block font-label text-[9px] tracking-[0.1em] uppercase text-ritual-gray-mid-2 mt-1 truncate">
                  {row.meta}
                </span>
              )}
            </span>
            <span className="font-label text-[9px] tracking-[0.14em] uppercase text-ritual-red whitespace-nowrap">
              {rowTag(row)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
