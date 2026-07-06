// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CollectionDiaryHeader, CollectionDiaryGrid, CollectionDiaryList } from '@/src/domains/events/components'
import type { DiaryRow } from '@/src/domains/events/collection-diary'

const ROWS: DiaryRow[] = [
  { id: 'r1', name: 'Divididos', venue: 'Niceto Club', year: 2024, rating: 4, href: '/events/r1' },
  { id: 'r2', name: 'Show sin puntaje', venue: null, year: 2023, rating: null, href: '/events/r2' },
]

function accessibleNamesOf(container: HTMLElement, selector: string) {
  return Array.from(container.querySelectorAll(selector)).map((el) => (el.getAttribute('aria-label') || el.textContent || '').trim())
}

describe('coleccion-mobile — Accessibility (A11y)', () => {
  describe('CollectionDiaryHeader (toggle state)', () => {
    it('expone exactamente un aria-current en el toggle de vista', () => {
      const { container } = render(<CollectionDiaryHeader headline={null} view="grilla" />)
      expect(container.querySelectorAll('[aria-current="true"]')).toHaveLength(1)
    })

    it('expone la lista de vistas con semántica de lista (role=list + listitem)', () => {
      render(<CollectionDiaryHeader headline={null} view="grilla" />)
      expect(screen.getByRole('list')).toBeInTheDocument()
      expect(screen.getAllByRole('listitem')).toHaveLength(2)
    })
  })

  describe('CollectionDiaryGrid (grid state)', () => {
    it('mantiene semántica de lista con cero filas (lista vacía, no rota)', () => {
      render(<CollectionDiaryGrid rows={[]} />)
      expect(screen.getByRole('list')).toBeInTheDocument()
      expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    })

    it('cada card es un link con nombre accesible no vacío', () => {
      const { container } = render(<CollectionDiaryGrid rows={ROWS} />)
      const names = accessibleNamesOf(container, 'a')
      expect(names).toHaveLength(2)
      expect(names.every((n) => n.length > 0)).toBe(true)
    })

    it('el puntaje lleva texto sr-only cuando está puntuado, y no existe cuando no lo está', () => {
      const { container } = render(<CollectionDiaryGrid rows={ROWS} />)
      const srOnly = container.querySelectorAll('.sr-only')
      expect(srOnly).toHaveLength(1)
      expect(srOnly[0].textContent).toMatch(/Le pusiste 4 de 5/)
    })
  })

  describe('CollectionDiaryList (list state)', () => {
    it('mantiene semántica de lista con cero filas', () => {
      render(<CollectionDiaryList rows={[]} />)
      expect(screen.getByRole('list')).toBeInTheDocument()
      expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    })

    it('cada fila es un link con nombre accesible no vacío', () => {
      const { container } = render(<CollectionDiaryList rows={ROWS} />)
      const names = accessibleNamesOf(container, 'a')
      expect(names).toHaveLength(2)
      expect(names.every((n) => n.length > 0)).toBe(true)
    })

    it('el puntaje lleva texto sr-only cuando está puntuado, y no existe cuando no lo está', () => {
      const { container } = render(<CollectionDiaryList rows={ROWS} />)
      const srOnly = container.querySelectorAll('.sr-only')
      expect(srOnly).toHaveLength(1)
      expect(srOnly[0].textContent).toMatch(/Le pusiste 4 de 5/)
    })
  })
})
