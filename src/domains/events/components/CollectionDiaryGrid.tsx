import Link from 'next/link'
import type { DiaryRow } from '@/src/domains/events/collection-diary'

export interface CollectionDiaryGridProps {
  rows: DiaryRow[]
}

/**
 * Grilla 2 columnas full-bleed (D-10 — `-mx-6` deshace el `px-6` de
 * `PageShell` para recuperar el edge-to-edge del mock). El puntaje siempre es
 * visible, nunca detrás de un hover (Requirement "Grid view").
 */
export function CollectionDiaryGrid({ rows }: CollectionDiaryGridProps) {
  return (
    <ul role="list" className="-mx-6 mt-5 grid grid-cols-2 gap-px bg-ritual-surface-high">
      {rows.map((row) => (
        <li key={row.id}>
          <Link href={row.href} className="relative block h-[210px] overflow-hidden bg-ritual-panel">
            <span aria-hidden="true" className="absolute inset-0 ritual-photo-fallback opacity-[.26]" />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-ritual-panel from-[8%] to-ritual-panel/[.05] to-[65%]"
            />
            <span className="absolute top-[9px] left-[9px] font-label text-[8px] tracking-[0.16em] text-ritual-paper-2 bg-ritual-panel/70 px-[5px] py-[3px]">
              {row.year}
            </span>
            <span className="absolute left-[9px] right-[9px] bottom-[9px]">
              <span className="block font-display text-[21px] leading-[0.94] uppercase text-ritual-bone">
                {row.name}
              </span>
              <span className="flex items-baseline justify-between mt-1">
                {row.venue && (
                  <span className="font-label text-[8px] tracking-[0.1em] uppercase text-ritual-gray-text">
                    {row.venue}
                  </span>
                )}
                {row.rating != null && (
                  <span className="font-display text-[15px] text-ritual-red ml-auto">
                    <span aria-hidden="true">{row.rating}/5</span>
                    <span className="sr-only">Le pusiste {row.rating} de 5</span>
                  </span>
                )}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
