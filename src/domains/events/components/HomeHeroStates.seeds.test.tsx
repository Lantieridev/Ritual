// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { HomeHero } from '@/src/domains/events/components/HomeHero'

/**
 * The first-time hero's seed ladder (issue #81): `FirstTimeHero` resolves
 * `seeds: Promise<{ names, note }>` via `use()` in its own Suspense, same
 * pattern as `TonightMobileHero`/`ResolvedTonightMeta` (see
 * `HomeHeroStates.tonight.test.tsx`) — never a hardcoded fallback list, and
 * the hero itself never waits on it.
 */
describe('FirstTimeHero — seed ladder (issue #81)', () => {
  it('renders the resolved seed names as links and the ladder note', async () => {
    let resolveSeeds!: (v: { names: string[]; note: string }) => void
    const pending = new Promise<{ names: string[]; note: string }>((resolve) => {
      resolveSeeds = resolve
    })

    await act(async () => {
      render(<HomeHero state={{ kind: 'first-time' }} backgroundImage={null} seeds={pending} />)
    })

    // Antes de resolver: fallback en hueco, nunca nombres inventados.
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('Bandalos Chinos')).not.toBeInTheDocument()

    await act(async () => {
      resolveSeeds({ names: ['Bandalos Chinos', 'El Mató', 'Usted Señálemelo'], note: 'De los géneros que elegiste' })
      await pending
    })

    expect(screen.getByRole('link', { name: /bandalos chinos/i })).toHaveAttribute('href', '/buscar?artist=Bandalos%20Chinos')
    expect(screen.getByText('De los géneros que elegiste')).toBeInTheDocument()
  })

  it('renders the tier-3 hardcoded note truthfully when the ladder degrades to it', async () => {
    let resolveSeeds!: (v: { names: string[]; note: string }) => void
    const pending = new Promise<{ names: string[]; note: string }>((resolve) => {
      resolveSeeds = resolve
    })

    await act(async () => {
      render(<HomeHero state={{ kind: 'first-time' }} backgroundImage={null} seeds={pending} />)
    })

    await act(async () => {
      resolveSeeds({ names: ['Divididos', 'Babasónicos', 'Wos', 'Trueno', 'Dillom', 'Las Pelotas'], note: 'Para arrancar' })
      await pending
    })

    expect(screen.getByText('Para arrancar')).toBeInTheDocument()
  })

  it('without a `seeds` prop, shows the loading fallback instead of fabricating names', () => {
    render(<HomeHero state={{ kind: 'first-time' }} backgroundImage={null} />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('Divididos')).not.toBeInTheDocument()
  })
})
