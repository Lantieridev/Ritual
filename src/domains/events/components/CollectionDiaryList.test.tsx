// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CollectionDiaryList } from './CollectionDiaryList'
import type { DiaryRow } from '@/src/domains/events/collection-diary'

const ROWS: DiaryRow[] = [
  { id: 'r1', name: 'Divididos', venue: 'Niceto Club', year: 2024, rating: 4, href: '/events/r1' },
  { id: 'r2', name: 'Show sin datos extra', venue: null, year: 2023, rating: null, href: '/events/r2' },
]

describe('CollectionDiaryList', () => {
  it('renders one link per row, each a single 60px tap target', () => {
    render(<CollectionDiaryList rows={ROWS} />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('href', '/events/r1')
    expect(links[0].className).toMatch(/min-h-\[60px\]/)
  })

  it('shows year, name, venue and score for a fully-populated row', () => {
    render(<CollectionDiaryList rows={ROWS} />)

    expect(screen.getByText('2024')).toBeInTheDocument()
    expect(screen.getByText('Divididos')).toBeInTheDocument()
    expect(screen.getByText('Niceto Club')).toBeInTheDocument()
    expect(screen.getByText('4/5')).toBeInTheDocument()
  })

  it('shows no score for an unrated row, consistent with the grid rule', () => {
    render(<CollectionDiaryList rows={ROWS} />)

    const row = screen.getByText('Show sin datos extra').closest('a')!
    expect(row.textContent).not.toMatch(/\/5/)
  })

  it('omits the venue segment entirely when venue is null', () => {
    render(<CollectionDiaryList rows={ROWS} />)

    const row = screen.getByText('Show sin datos extra').closest('a')!
    expect(row.textContent).not.toMatch(/sede/i)
  })
})
