import Link from 'next/link'
import type { DiaryRow } from '@/src/domains/events/collection-diary'

export interface CollectionDiaryListProps {
  rows: DiaryRow[]
}

/**
 * Vista lista (`?vista=lista`) — filas de 60px, satisface la regla de 44px
 * de blanco de toque (Requirement "List view").
 */
export function CollectionDiaryList({ rows }: CollectionDiaryListProps) {
  return (
    <ul role="list" className="mt-[18px]">
      {rows.map((row) => (
        <li key={row.id}>
          <Link href={row.href} className="flex items-center gap-3 py-3 min-h-[60px] border-b border-ritual-surface-high">
            <span className="font-figure text-[21px] tracking-[0.06em] text-ritual-red w-11 flex-none">
              {row.year}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-subtitle font-black text-[21px] uppercase leading-none text-ritual-bone">
                {row.name}
              </span>
              {row.venue && (
                <span className="block font-label text-[9px] tracking-[0.1em] uppercase text-ritual-gray-mid-2 mt-[3px]">
                  {row.venue}
                </span>
              )}
            </span>
            {row.rating != null && (
              <span className="font-display text-[18px] text-ritual-bone">
                <span aria-hidden="true">{row.rating}/5</span>
                <span className="sr-only">Le pusiste {row.rating} de 5</span>
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}
