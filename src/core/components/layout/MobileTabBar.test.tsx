// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { MobileTabBar, isBandaRoute, BANDA_ROUTES } from '@/src/core/components/layout/MobileTabBar'

/**
 * Banda de "Tu entrada de hoy" vs. acción de página (issue #82). La banda
 * gana en /buscar, /coleccion y /profile; en cualquier otra ruta (sobre
 * todo Home) no aparece nunca, aunque el layout la mande — ahí la acción
 * principal la decide la página con <MobileHeroAction>.
 */
vi.mock('next/navigation', () => ({ usePathname: vi.fn(() => '/') }))

const banda = {
  subtitle: 'Tu entrada de hoy',
  title: 'Divididos en Obras',
  actionLabel: 'Ver entrada',
  href: '/?entrada=hoy',
}

const hero = { label: 'Abrir mi entrada', href: '/ticket' }

function setPath(path: string) {
  vi.mocked(usePathname).mockReturnValue(path)
}

describe('BANDA_ROUTES / isBandaRoute', () => {
  it('incluye exactamente Buscar, Colección y Vos (perfil)', () => {
    expect(BANDA_ROUTES).toEqual(['/buscar', '/coleccion', '/profile'])
  })

  it.each([
    ['/buscar', true],
    ['/coleccion', true],
    ['/coleccion/rock-and-blues', true],
    ['/profile', true],
    ['/', false],
    ['/events/1', false],
    // Un prefijo suelto no debe dar falso positivo (issue #82).
    ['/buscar-algo', false],
  ])('isBandaRoute(%s) → %s', (pathname, expected) => {
    expect(isBandaRoute(pathname)).toBe(expected)
  })
})

describe('MobileTabBar — banda vs. acción de página (#82)', () => {
  it.each([
    ['/', true, true, false, true],
    ['/', true, false, false, false],
    ['/buscar', true, true, true, false],
    ['/buscar', true, false, true, false],
    ['/coleccion/rock-and-blues', true, true, true, false],
    ['/profile', true, true, true, false],
    ['/events/1', true, true, false, true],
    ['/events/1', true, false, false, false],
  ] as const)(
    'en %s con banda=%s y heroAction=%s → banda visible=%s, hero visible=%s',
    (pathname, hasBanda, hasHero, expectBanda, expectHero) => {
      setPath(pathname)
      render(<MobileTabBar bandaAction={hasBanda ? banda : undefined} heroAction={hasHero ? hero : undefined} />)

      const bandaLink = screen.queryByRole('link', { name: /Divididos en Obras/i })
      const heroLink = screen.queryByRole('link', { name: 'Abrir mi entrada' })

      expect(Boolean(bandaLink)).toBe(expectBanda)
      expect(Boolean(heroLink)).toBe(expectHero)
    }
  )

  it('exactamente una acción primaria visible a la vez (data-mobile-primary)', () => {
    setPath('/buscar')
    const { container } = render(<MobileTabBar bandaAction={banda} heroAction={hero} />)
    expect(container.querySelectorAll('[data-mobile-primary]')).toHaveLength(1)
  })

  it('la banda se renderiza únicamente como <a href>, nunca con onClick', () => {
    setPath('/buscar')
    render(<MobileTabBar bandaAction={banda} />)
    const link = screen.getByRole('link', { name: /Divididos en Obras/i })
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/?entrada=hoy')
  })

  it('un MobileBandaLink servido del lado del servidor (sin funciones) no rompe el render', () => {
    setPath('/profile')
    // Simula la forma exacta que puede mandar un Server Component: sólo
    // datos serializables, sin onClick — nunca podría llevar una función.
    const serverSafeBanda: { subtitle: string; title: string; actionLabel: string; href: string } = {
      subtitle: 'Tu entrada de hoy',
      title: 'Wos en Movistar Arena',
      actionLabel: 'Abrir',
      href: '/?entrada=hoy',
    }
    expect(() => render(<MobileTabBar bandaAction={serverSafeBanda} />)).not.toThrow()
    expect(screen.getByRole('link', { name: /Wos en Movistar Arena/i })).toBeInTheDocument()
  })
})

describe('MobileTabBar — clearance de la banda (data-mobile-banda)', () => {
  afterEach(() => {
    delete document.documentElement.dataset.mobileBanda
  })

  it('marca <html data-mobile-banda> mientras la banda está visible', () => {
    setPath('/buscar')
    render(<MobileTabBar bandaAction={banda} />)
    expect(document.documentElement.dataset.mobileBanda).toBe('true')
  })

  it('no marca la banda en Home, aunque venga bandaAction', () => {
    setPath('/')
    render(<MobileTabBar bandaAction={banda} />)
    expect(document.documentElement.dataset.mobileBanda).toBeUndefined()
  })

  it('retira la marca al desmontar', () => {
    setPath('/buscar')
    const { unmount } = render(<MobileTabBar bandaAction={banda} />)
    expect(document.documentElement.dataset.mobileBanda).toBe('true')
    unmount()
    expect(document.documentElement.dataset.mobileBanda).toBeUndefined()
  })
})
