// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SearchRowList } from '@/src/domains/search/components/SearchRowList'
import { routes } from '@/src/core/lib/routes'
import type { SearchRow } from '@/src/domains/search/rows'

const ROWS: SearchRow[] = [
  { kind: 'event', id: 'e1', title: 'Show en Obras', meta: '14 feb 2026', href: routes.events.detail('e1') },
  { kind: 'artist', id: 'a1', title: 'Divididos', meta: 'Rock', href: routes.artists.detail('a1') },
  { kind: 'venue', id: 'v1', title: 'Estadio Obras', meta: null, href: routes.venues.detail('v1') },
  { kind: 'festival', id: 'f1', title: 'Cosquín Rock', meta: 'Festival · 2026', href: routes.festivals.detail('f1') },
]

describe('SearchRowList', () => {
  it('renders one row per entry, each a link to the right detail route', () => {
    render(<SearchRowList rows={ROWS} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByRole('link', { name: /Show en Obras/ })).toHaveAttribute('href', routes.events.detail('e1'))
    expect(screen.getByRole('link', { name: /Divididos/ })).toHaveAttribute('href', routes.artists.detail('a1'))
    expect(screen.getByRole('link', { name: /Estadio Obras/ })).toHaveAttribute('href', routes.venues.detail('v1'))
    expect(screen.getByRole('link', { name: /Cosquín Rock/ })).toHaveAttribute('href', routes.festivals.detail('f1'))
  })

  it('shows the meta line only when it is not null', () => {
    render(<SearchRowList rows={ROWS} />)

    expect(screen.getByText('Rock')).toBeInTheDocument()
    expect(screen.queryByText('null')).not.toBeInTheDocument()
  })

  it('shows "A N KM" instead of the kind tag when distanceKm is set (only for nearby venues)', () => {
    const nearby: SearchRow[] = [
      { kind: 'venue', id: 'v2', title: 'Club Cercano', meta: 'Córdoba', href: routes.venues.detail('v2'), distanceKm: 3.4 },
    ]
    render(<SearchRowList rows={nearby} />)

    expect(screen.getByText('A 3 KM')).toBeInTheDocument()
  })
})
