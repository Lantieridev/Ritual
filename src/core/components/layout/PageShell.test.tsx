// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageShell } from '@/src/core/components/layout/PageShell'

describe('PageShell', () => {
  it('renders the title and children', () => {
    render(
      <PageShell title="Wishlist">
        <p>Contenido</p>
      </PageShell>
    )
    expect(screen.getByRole('heading', { name: 'Wishlist' })).toBeInTheDocument()
    expect(screen.getByText('Contenido')).toBeInTheDocument()
  })

  it('renders the description only when provided', () => {
    const { rerender } = render(
      <PageShell title="Wishlist" description="Artistas que seguís.">
        <p>Contenido</p>
      </PageShell>
    )
    expect(screen.getByText('Artistas que seguís.')).toBeInTheDocument()

    rerender(
      <PageShell title="Wishlist">
        <p>Contenido</p>
      </PageShell>
    )
    expect(screen.queryByText('Artistas que seguís.')).not.toBeInTheDocument()
  })

  it(
    'renders a back link when backHref is provided ' +
      '(regression test: backHref/backLabel were accepted as props but never rendered — ' +
      '9 pages passed them expecting back navigation that silently never appeared)',
    () => {
      render(
        <PageShell title="Wishlist" backHref="/" backLabel="← Inicio">
          <p>Contenido</p>
        </PageShell>
      )
      expect(screen.getByRole('link', { name: '← Inicio' })).toHaveAttribute('href', '/')
    }
  )

  it('omits the back link entirely when backHref is not provided', () => {
    render(
      <PageShell title="Wishlist">
        <p>Contenido</p>
      </PageShell>
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('falls back to a generic "← Volver" label when backHref is set without backLabel', () => {
    render(
      <PageShell title="Wishlist" backHref="/">
        <p>Contenido</p>
      </PageShell>
    )
    expect(screen.getByRole('link', { name: '← Volver' })).toBeInTheDocument()
  })

  it('renders the action slot when provided', () => {
    render(
      <PageShell title="Wishlist" action={<button>Nuevo</button>}>
        <p>Contenido</p>
      </PageShell>
    )
    expect(screen.getByRole('button', { name: 'Nuevo' })).toBeInTheDocument()
  })
})
