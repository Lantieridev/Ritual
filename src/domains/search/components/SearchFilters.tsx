import Link from 'next/link'
import { buscarHref, type SearchFilter } from '@/src/domains/search/rows'

export interface SearchFiltersProps {
  active: SearchFilter
  query: string
}

const FILTERS: SearchFilter[] = ['todo', 'artistas', 'sedes', 'festivales', 'cerca']

const CHIP_LABELS: Record<SearchFilter, string> = {
  todo: 'Todo',
  artistas: 'Artistas',
  sedes: 'Sedes',
  festivales: 'Festivales',
  cerca: 'Cerca',
}

function chipClass(isActive: boolean) {
  return isActive
    ? 'bg-ritual-red text-ritual-panel border border-ritual-red'
    : 'bg-transparent text-ritual-gray-text border border-ritual-mobile-line'
}

/** Fila de 5 chips (Requirement "Chip filter set") — tap target ≥44px, `Link`s planos, sin estado de cliente. */
export function SearchFilters({ active, query }: SearchFiltersProps) {
  return (
    <ul role="list" className="flex gap-2 overflow-x-auto pt-4">
      {FILTERS.map((filtro) => {
        const isActive = filtro === active
        return (
          <li key={filtro} className="flex-none">
            <Link
              href={buscarHref({ q: query, filtro })}
              aria-current={isActive ? 'true' : undefined}
              className={`flex min-h-[44px] items-center px-[14px] font-figure text-base tracking-[0.1em] uppercase ${chipClass(isActive)}`}
            >
              {CHIP_LABELS[filtro]}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
