// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileTabBar } from '@/src/core/components/layout/MobileTabBar'
import { MobileActionProvider, MobileHeroAction } from '@/src/core/components/layout/MobileAction'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

describe('MobileTabBar — Accessibility (A11y)', () => {
  it('contiene aria-current="page" únicamente en la pestaña activa', () => {
    const { container } = render(<MobileTabBar />)

    const activeLink = screen.getByRole('link', { name: 'Hoy' })
    expect(activeLink).toHaveAttribute('aria-current', 'page')

    const inactiveTabNames = ['Buscar', 'Archivo', 'Vos']
    for (const name of inactiveTabNames) {
      const link = screen.getByRole('link', { name })
      expect(link).not.toHaveAttribute('aria-current')
    }

    const currentElements = container.querySelectorAll('[aria-current="page"]')
    expect(currentElements).toHaveLength(1)
  })

  it('los indicadores de pestaña (TabMark) son elementos decorativos marcados con aria-hidden', () => {
    render(<MobileTabBar />)
    const activeLink = screen.getByRole('link', { name: 'Hoy' })
    const tabMark = activeLink.querySelector('span[aria-hidden="true"]')

    expect(tabMark).not.toBeNull()
    expect(tabMark).toHaveAttribute('aria-hidden', 'true')
  })

  it('todos los enlaces y botones poseen un nombre accesible no vacío', () => {
    const { container } = render(
      <MobileActionProvider>
        <MobileHeroAction label="Abrir mi entrada" href="/ticket" altLabel="Ver detalles" altHref="/details" />
        <MobileTabBar />
      </MobileActionProvider>
    )

    const interactiveElements = container.querySelectorAll('a, button')
    expect(interactiveElements.length).toBeGreaterThan(0)

    for (const el of Array.from(interactiveElements)) {
      const ariaLabel = el.getAttribute('aria-label')
      const text = el.textContent?.trim()
      const accessibleName = ariaLabel || text || ''
      expect(accessibleName.length).toBeGreaterThan(0)
    }
  })

  it('soporta bandaAction con botones/enlaces que poseen nombres accesibles válidos', () => {
    const { container } = render(
      <MobileTabBar
        bandaAction={{
          subtitle: 'Tu entrada de hoy',
          title: 'Divididos en Obras',
          actionLabel: 'Ver entrada',
          href: '/ticket',
        }}
      />
    )

    const bandaLink = screen.getByRole('link', { name: /Divididos en Obras/i })
    expect(bandaLink).toBeInTheDocument()

    const interactiveElements = container.querySelectorAll('a, button')
    for (const el of Array.from(interactiveElements)) {
      const text = el.textContent?.trim()
      expect(text?.length).toBeGreaterThan(0)
    }
  })

  it('no contiene ningún elemento con tabindex positivo (> 0)', () => {
    const { container } = render(
      <MobileActionProvider>
        <MobileHeroAction label="Abrir entrada" href="/ticket" />
        <MobileTabBar />
      </MobileActionProvider>
    )

    const elementsWithTabIndex = container.querySelectorAll('[tabindex]')
    for (const el of Array.from(elementsWithTabIndex)) {
      const val = parseInt(el.getAttribute('tabindex') || '0', 10)
      expect(val).toBeLessThanOrEqual(0)
    }
  })
})
