import { routes } from '@/src/core/lib/routes'
import type { SearchFilter } from '@/src/domains/search/rows'

export interface SearchFieldProps {
  defaultValue: string
  filter: SearchFilter
}

/**
 * Campo de búsqueda sticky de la pantalla mobile (Requirement "Sticky search
 * field"). GET plano a /buscar, sin debounce (D-2 del design.md) — la
 * navegación entera vive en la URL, no en estado de cliente.
 */
export function SearchField({ defaultValue, filter }: SearchFieldProps) {
  return (
    <form method="GET" action={routes.events.search} className="sticky top-0 z-10 bg-ritual-bg pt-4 pb-3">
      <input type="hidden" name="tab" value="archivo" />
      <input type="hidden" name="filtro" value={filter} />
      <label htmlFor="buscar-mobile-q" className="sr-only">
        Buscar
      </label>
      <div className="flex items-center gap-[10px] border-b-2 border-ritual-red pb-[10px]">
        <span aria-hidden="true" className="font-label text-sm text-ritual-red">
          /
        </span>
        <input
          id="buscar-mobile-q"
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder="artista, sede, festival"
          autoComplete="off"
          className="w-full bg-transparent font-body text-[19px] text-ritual-bone placeholder-ritual-gray-mid-2 focus:outline-none"
        />
      </div>
    </form>
  )
}
