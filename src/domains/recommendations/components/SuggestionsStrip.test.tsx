// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { SuggestionsStrip, SuggestionsStripSkeleton } from '@/src/domains/recommendations/components/SuggestionsStrip'
import { stripHeading } from '@/src/domains/recommendations/heading'
import { formatDate } from '@/src/core/lib/utils'
import type { StripHeadingInput } from '@/src/domains/recommendations/types'
import type { SuggestionsStripCandidate } from '@/src/domains/recommendations/components/SuggestionsStrip'

const PERSONAL_HEADING: StripHeadingInput = {
  basis: 'behavior',
  hasCoords: true,
  city: 'La Plata',
  sources: ['lastfm'],
  declaredGenreLabels: [],
}

const GENERAL_HEADING: StripHeadingInput = {
  basis: 'none',
  hasCoords: false,
  city: null,
  sources: [],
  declaredGenreLabels: [],
}

function candidate(overrides: Partial<SuggestionsStripCandidate> & Pick<SuggestionsStripCandidate, 'key'>): SuggestionsStripCandidate {
  return {
    href: `/events/${overrides.key}`,
    headliner: 'Divididos',
    venueName: 'Niceto',
    startsAt: '2026-09-20T21:00:00-03:00',
    reason: 'está en tu wishlist',
    image: null,
    ...overrides,
  }
}

describe('SuggestionsStrip — heading', () => {
  it('renders the title and note produced by stripHeading() for the given input', () => {
    render(<SuggestionsStrip heading={PERSONAL_HEADING} candidates={[]} />)

    const expected = stripHeading(PERSONAL_HEADING)
    expect(screen.getByRole('heading', { name: expected.title.replace(/\n/g, ' ') })).toBeInTheDocument()
    expect(screen.getByText(expected.note)).toBeInTheDocument()
  })

  it('renders the guest/general heading truthfully when basis is none', () => {
    render(<SuggestionsStrip heading={GENERAL_HEADING} candidates={[]} />)

    const expected = stripHeading(GENERAL_HEADING)
    expect(screen.getByText(expected.note)).toBeInTheDocument()
  })
})

describe('SuggestionsStrip — list semantics and card accessible name', () => {
  it('renders the candidates as a list', () => {
    render(<SuggestionsStrip heading={PERSONAL_HEADING} candidates={[candidate({ key: 'a' })]} />)

    expect(screen.getByRole('list')).toBeInTheDocument()
  })

  it('gives each card an accessible name ordered name → venue → date → reason', () => {
    render(
      <SuggestionsStrip
        heading={PERSONAL_HEADING}
        candidates={[
          candidate({
            key: 'a',
            headliner: 'Divididos',
            venueName: 'Niceto',
            startsAt: '2026-09-20T21:00:00-03:00',
            reason: 'está en tu wishlist',
          }),
        ]}
      />
    )

    const when = formatDate('2026-09-20T21:00:00-03:00', { day: 'numeric', month: 'short' })
    const link = screen.getByRole('link', { name: /divididos/i })
    const name = link.textContent ?? ''
    expect(name.indexOf('Divididos')).toBeLessThan(name.indexOf('Niceto'))
    expect(name.indexOf('Niceto')).toBeLessThan(name.indexOf(when))
    expect(name.indexOf(when)).toBeLessThan(name.indexOf('está en tu wishlist'))
  })

  it('renders no reason line when the candidate has no reason', () => {
    render(<SuggestionsStrip heading={PERSONAL_HEADING} candidates={[candidate({ key: 'a', reason: null })]} />)

    const link = screen.getByRole('link', { name: /divididos/i })
    expect(link.textContent).not.toMatch(/wishlist|viste|género|escuchado|cargar/i)
  })

  it('renders one list item per candidate, each linking to its own href', () => {
    render(
      <SuggestionsStrip
        heading={PERSONAL_HEADING}
        candidates={[candidate({ key: 'a', headliner: 'Divididos' }), candidate({ key: 'b', headliner: 'El Mató' })]}
      />
    )

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByRole('link')).toHaveAttribute('href', '/events/a')
    expect(within(items[1]).getByRole('link')).toHaveAttribute('href', '/events/b')
  })

  it('renders an empty list when there are no candidates, without hiding the heading', () => {
    render(<SuggestionsStrip heading={PERSONAL_HEADING} candidates={[]} />)

    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByRole('list')).toBeInTheDocument()
  })
})

describe('SuggestionsStripSkeleton', () => {
  it('exposes a status role with the sr-only searching message', () => {
    render(<SuggestionsStripSkeleton />)

    expect(screen.getByRole('status')).toHaveTextContent('Buscando shows para vos')
  })
})
