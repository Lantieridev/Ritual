// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MobileActionProvider, MobileHeroAction } from '@/src/core/components/layout/MobileAction'
import { MobileTabBar } from '@/src/core/components/layout/MobileTabBar'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

afterEach(() => {
  cleanup()
  delete document.documentElement.dataset.mobileAction
})

describe('MobileHeroAction', () => {
  it('la acción que registra la página aparece fija sobre el talón', () => {
    render(
      <MobileActionProvider>
        <MobileHeroAction label="Cargar un show" href="/events/nuevo" />
        <MobileTabBar />
      </MobileActionProvider>
    )

    expect(screen.getByRole('link', { name: 'Cargar un show' })).toHaveAttribute('href', '/events/nuevo')
  })

  it('marca <html> para que el aire inferior de la página crezca con la pila', () => {
    render(
      <MobileActionProvider>
        <MobileHeroAction label="Cargar un show" href="/events/nuevo" />
      </MobileActionProvider>
    )

    expect(document.documentElement.dataset.mobileAction).toBe('hero')
  })

  it('con acción secundaria usa el aire más alto y dibuja las dos', () => {
    render(
      <MobileActionProvider>
        <MobileHeroAction label="Buscar mi primer show" href="/buscar" altLabel="Cargarlo a mano" altHref="/events/nuevo" />
        <MobileTabBar />
      </MobileActionProvider>
    )

    expect(document.documentElement.dataset.mobileAction).toBe('alt')
    expect(screen.getByRole('link', { name: 'Cargarlo a mano' })).toHaveAttribute('href', '/events/nuevo')
  })

  it('cuando la página se va, la acción y la marca se van con ella', () => {
    const { rerender } = render(
      <MobileActionProvider>
        <MobileHeroAction label="Cargar un show" href="/events/nuevo" />
        <MobileTabBar />
      </MobileActionProvider>
    )

    rerender(
      <MobileActionProvider>
        <MobileTabBar />
      </MobileActionProvider>
    )

    expect(screen.queryByRole('link', { name: 'Cargar un show' })).not.toBeInTheDocument()
    expect(document.documentElement.dataset.mobileAction).toBeUndefined()
  })

  it('fuera de un provider no rompe ni dibuja nada', () => {
    const { container } = render(<MobileHeroAction label="Cargar un show" href="/events/nuevo" />)

    expect(container).toBeEmptyDOMElement()
  })
})

describe('MobileTabBar', () => {
  it('son cuatro palabras y la actual queda marcada como página', () => {
    render(<MobileTabBar />)

    expect(screen.getByRole('link', { name: 'Hoy' })).toHaveAttribute('aria-current', 'page')
    for (const name of ['Buscar', 'Archivo', 'Vos']) {
      expect(screen.getByRole('link', { name })).not.toHaveAttribute('aria-current')
    }
  })

  it('sin sesión, Vos lleva al login', () => {
    render(<MobileTabBar user={null} />)

    expect(screen.getByRole('link', { name: 'Vos' })).toHaveAttribute('href', '/login')
  })
})
