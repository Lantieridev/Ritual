import Link from 'next/link'
import { coleccionHref, type CollectionView } from '@/src/domains/events/collection-diary'

export interface CollectionDiaryHeaderProps {
  /** `diaryHeadline(rows)` — `null` cuando no hay filas, nunca un conteo inventado. */
  headline: string | null
  view: CollectionView
}

const VIEWS: Array<{ value: CollectionView; label: string }> = [
  { value: 'grilla', label: 'Grilla' },
  { value: 'lista', label: 'Lista' },
]

const TOGGLE_BASE =
  'flex min-h-[44px] items-center px-3 border border-ritual-mobile-line font-label text-[9px] tracking-[0.14em] uppercase'

/**
 * Toggle de vista server-rendered — dos `Link`s, no un solo botón que
 * alterna estado (D-4): un lector de pantalla no puede distinguir "modo
 * actual" de "destino" en un botón que dice "Lista" para pasar a lista.
 */
export function CollectionDiaryHeader({ headline, view }: CollectionDiaryHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-3 mt-5">
      {headline && (
        <p className="font-label text-[9px] tracking-[0.18em] uppercase text-ritual-gray-mid-2">{headline}</p>
      )}
      <ul role="list" aria-label="Vista de la colección" className="flex gap-2">
        {VIEWS.map(({ value, label }) => {
          const isActive = value === view
          return (
            <li key={value} className="flex-none">
              <Link
                href={coleccionHref(value)}
                aria-current={isActive ? 'true' : undefined}
                className={`${TOGGLE_BASE} ${isActive ? 'text-ritual-bone' : 'text-ritual-gray-text'}`}
              >
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
