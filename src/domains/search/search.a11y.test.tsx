// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SearchField } from '@/src/domains/search/components/SearchField'
import { SearchFilters } from '@/src/domains/search/components/SearchFilters'
import { SearchRowList } from '@/src/domains/search/components/SearchRowList'
import { NearbyNotice } from '@/src/domains/search/components/NearbyNotice'
import { routes } from '@/src/core/lib/routes'
import type { SearchRow } from '@/src/domains/search/rows'

const ROWS: SearchRow[] = [
  { kind: 'event', id: 'e1', title: 'Show en Obras', meta: '14 feb 2026', href: routes.events.detail('e1') },
  { kind: 'artist', id: 'a1', title: 'Divididos', meta: 'Rock', href: routes.artists.detail('a1') },
]

function accessibleNamesOf(container: HTMLElement, selector: string) {
  return Array.from(container.querySelectorAll(selector)).map((el) => (el.getAttribute('aria-label') || el.textContent || '').trim())
}

describe('buscar-mobile — Accessibility (A11y)', () => {
  describe('SearchField (sticky field state)', () => {
    it('tiene un label accesible asociado al input, aunque esté visualmente oculto', () => {
      render(<SearchField defaultValue="" filter="todo" />)
      expect(screen.getByLabelText('Buscar')).toBeInTheDocument()
    })
  })

  describe('SearchFilters (chips state)', () => {
    it('cada chip tiene un nombre accesible no vacío y sólo el activo lleva aria-current', () => {
      const { container } = render(<SearchFilters active="festivales" query="cosquin" />)
      const names = accessibleNamesOf(container, 'a')
      expect(names.every((n) => n.length > 0)).toBe(true)
      expect(container.querySelectorAll('[aria-current="true"]')).toHaveLength(1)
    })

    it('expone la lista de chips con semántica de lista (role=list + listitem)', () => {
      render(<SearchFilters active="todo" query="" />)
      expect(screen.getByRole('list')).toBeInTheDocument()
      expect(screen.getAllByRole('listitem')).toHaveLength(5)
    })
  })

  describe('SearchRowList (results state)', () => {
    it('expone semántica de lista y cada fila es un link con nombre accesible', () => {
      const { container } = render(<SearchRowList rows={ROWS} />)
      expect(screen.getByRole('list')).toBeInTheDocument()
      expect(screen.getAllByRole('listitem')).toHaveLength(2)
      const names = accessibleNamesOf(container, 'a')
      expect(names.every((n) => n.length > 0)).toBe(true)
    })

    it('con cero resultados sigue siendo una lista válida (vacía), sin filas rotas', () => {
      render(<SearchRowList rows={[]} />)
      expect(screen.getByRole('list')).toBeInTheDocument()
      expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    })
  })

  describe('NearbyNotice (degradación honesta de "Cerca")', () => {
    it('no-session: el link de acción tiene nombre accesible no vacío', () => {
      const { container } = render(<NearbyNotice status="no-session" />)
      const names = accessibleNamesOf(container, 'a')
      expect(names).toEqual(['Entrar'])
    })

    it('no-city: el link de acción tiene nombre accesible no vacío', () => {
      const { container } = render(<NearbyNotice status="no-city" />)
      const names = accessibleNamesOf(container, 'a')
      expect(names).toEqual(['Ir al perfil'])
    })
  })
})
