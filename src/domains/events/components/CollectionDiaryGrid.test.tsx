// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CollectionDiaryGrid } from './CollectionDiaryGrid'
import type { DiaryRow } from '@/src/domains/events/collection-diary'

const ROWS: DiaryRow[] = [
  { id: 'r1', name: 'Divididos', venue: 'Niceto Club', year: 2024, rating: 4, href: '/events/r1' },
  { id: 'r2', name: 'Show sin datos extra', venue: null, year: 2023, rating: null, href: '/events/r2' },
]

describe('CollectionDiaryGrid', () => {
  it('renders one link per row inside a 2-column grid', () => {
    render(<CollectionDiaryGrid rows={ROWS} />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('href', '/events/r1')
    expect(links[1]).toHaveAttribute('href', '/events/r2')
  })

  it('shows year, name, venue and score for a fully-populated row', () => {
    render(<CollectionDiaryGrid rows={ROWS} />)

    expect(screen.getByText('2024')).toBeInTheDocument()
    expect(screen.getByText('Divididos')).toBeInTheDocument()
    expect(screen.getByText('Niceto Club')).toBeInTheDocument()
    expect(screen.getByText('4/5')).toBeInTheDocument()
  })

  it('renders no score node at all when the row is unrated (no dash, no placeholder)', () => {
    render(<CollectionDiaryGrid rows={ROWS} />)

    const card = screen.getByText('Show sin datos extra').closest('a')!
    expect(card.textContent).not.toMatch(/\/5/)
    expect(card.textContent).not.toMatch(/[—–-]\s*$/)
  })

  it('omits the venue segment entirely when venue is null (no "Sin sede" filler text)', () => {
    render(<CollectionDiaryGrid rows={ROWS} />)

    const card = screen.getByText('Show sin datos extra').closest('a')!
    expect(card.textContent).not.toMatch(/sede/i)
  })
})
