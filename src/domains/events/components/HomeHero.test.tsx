// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HomeHero } from '@/src/domains/events/components/HomeHero'
import type { EventWithAttendance } from '@/src/domains/events/service'

/**
 * El hero del Inicio se porta pixel-perfect del handoff de rediseño (01 del
 * README del bundle). Estos tests fijan los valores que el diseño define
 * explícitamente, porque son los que hacen que la pantalla se lea como el
 * mockup y los que ya se habían perdido una vez: el contador en hueco, el
 * talón fundido con la foto, y el enganche del scroll.
 */

const event: EventWithAttendance = {
  id: 'e1',
  name: 'Show en Obras',
  date: '2026-12-24',
  venue_id: 'v1',
  venues: { name: 'Estadio Obras', city: 'CABA', country: 'AR' },
  lineups: [{ artists: { id: 'a1', name: 'Divididos', genre: 'Rock' }, is_headliner: true }],
} as unknown as EventWithAttendance

function renderNormal(daysUntil: number | null) {
  return render(
    <HomeHero state={{ kind: 'normal', nextShow: event, daysUntil }} backgroundImage="https://x/y.jpg" />
  )
}

describe('HomeHero — contador de días', () => {
  it('lo dibuja en hueco con los valores exactos del diseño (23vh, trazo hueso al 50%)', () => {
    const { container } = renderNormal(112)

    const num = Array.from(container.querySelectorAll('div')).find(
      (d) => d.textContent?.trim() === '112'
    )
    expect(num).toBeTruthy()

    const s = num!.style
    expect(s.fontSize).toBe('23vh')
    expect(s.color).toBe('transparent')
    // El navegador normaliza `.78` a `0.78` al parsear el estilo inline.
    expect(parseFloat(s.lineHeight)).toBeCloseTo(0.78)
    expect(s.letterSpacing).toBe('-.03em')
    // El trazo es hueso translúcido, no rojo: el rojo es el acento de marca y
    // acá compite con el CTA. El diseño lo fija en rgba(237,235,230,.5).
    expect(num!.getAttribute('style')).toContain('237,235,230')
  })

  it('lo oculta de lectores de pantalla — es decorativo, la fecha ya está en el texto', () => {
    const { container } = renderNormal(112)
    const num = Array.from(container.querySelectorAll('div')).find((d) => d.textContent?.trim() === '112')
    expect(num).toHaveAttribute('aria-hidden', 'true')
  })

  it('no dibuja el contador cuando el show es hoy: muestra el sello "es hoy"', () => {
    render(<HomeHero state={{ kind: 'show-today', event }} backgroundImage={null} />)
    expect(screen.getByText('es hoy')).toBeInTheDocument()
  })
})

describe('HomeHero — el talón', () => {
  it('está siempre en cuadro y fundido con la foto, no escondido tras el click', () => {
    const { container } = renderNormal(12)

    const ticket = Array.from(container.querySelectorAll('div')).find(
      (d) => d.style.mixBlendMode === 'screen'
    )
    expect(ticket).toBeTruthy()
    expect(ticket!.style.left).toBe('46%')
    expect(ticket!.style.top).toBe('-14%')
    expect(ticket!.style.width).toBe('60%')
    expect(ticket!.style.height).toBe('128%')
  })

  it('arranca cerrado, en su pose de reposo', () => {
    const { container } = renderNormal(12)
    const ticket = Array.from(container.querySelectorAll('div')).find(
      (d) => d.style.mixBlendMode === 'screen'
    )
    expect(ticket!.style.transform).toBe('translateX(0) scale(1)')
    expect(ticket!.style.opacity).toBe('0.85')
  })

  it('el botón de abrir existe y es el del diseño', () => {
    renderNormal(12)
    expect(screen.getByRole('button', { name: 'ABRIR MI ENTRADA' })).toBeInTheDocument()
  })
})

describe('HomeHero — el resto del hero', () => {
  it('el contador viene con su kicker: el número solo no dice de qué es', () => {
    renderNormal(112)
    expect(screen.getByText('días para el ritual')).toBeInTheDocument()
  })

  it('no muestra el kicker si el show es hoy — ya no faltan días', () => {
    render(<HomeHero state={{ kind: 'show-today', event }} backgroundImage={null} />)
    expect(screen.queryByText('días para el ritual')).not.toBeInTheDocument()
  })

  // Con scroll snap, sin esta señal el hero se lee como toda la página.
  it('indica que hay más abajo', () => {
    renderNormal(12)
    expect(screen.getByText('seguí bajando')).toBeInTheDocument()
  })

  it('el secundario dice "Ver función", como el diseño', () => {
    renderNormal(12)
    expect(screen.getByRole('link', { name: 'Ver función' })).toBeInTheDocument()
  })

  it('los botones llevan los hovers del prototipo', () => {
    renderNormal(12)
    expect(screen.getByRole('button', { name: 'ABRIR MI ENTRADA' }).className).toContain('ritual-cta')
    expect(screen.getByRole('link', { name: 'Ver función' }).className).toContain('ritual-btn')
  })

  it('el hero tiene bloque tonal debajo, para no quedar en negro plano sin foto', () => {
    const { container } = render(
      <HomeHero state={{ kind: 'normal', nextShow: event, daysUntil: 12 }} backgroundImage={null} />
    )
    expect(container.querySelector('.ritual-photo-fallback')).toBeTruthy()
  })

  it('cuando hay foto, se le aplica el tratamiento de fondo de la marca', () => {
    const { container } = renderNormal(12)
    const foto = container.querySelector('.ritual-photo')
    expect(foto?.className).toContain('ritual-photo-bg')
  })
})

describe('HomeHero — scroll snap', () => {
  it.each([
    ['normal', { kind: 'normal', nextShow: event, daysUntil: 12 }],
    ['show-today', { kind: 'show-today', event }],
    ['vacío', { kind: 'normal', nextShow: undefined, daysUntil: null }],
  ] as const)('la sección engancha el scroll en el estado %s', (_label, state) => {
    const { container } = render(<HomeHero state={state as never} backgroundImage={null} />)
    const section = container.querySelector('section')
    expect(section?.className).toContain('snap-start')
  })
})
