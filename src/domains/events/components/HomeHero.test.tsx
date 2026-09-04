// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { HomeHero } from '@/src/domains/events/components/HomeHero'
import { MobileActionProvider } from '@/src/core/components/layout/MobileAction'
import { MobileTabBar } from '@/src/core/components/layout/MobileTabBar'
import type { EventWithAttendance } from '@/src/domains/events/service'

// El puntaje de "la mañana después" guarda vía Server Action y refresca el
// router: ninguno de los dos existe fuera de Next. `usePathname` lo pide
// MobileTabBar, que hace falta acá para disparar la acción hoisted.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => '/' }))
vi.mock('@/src/domains/events/attendance-actions', () => ({ saveMemory: vi.fn(async () => ({})) }))

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

function withAttendance(overrides: Partial<EventWithAttendance>, status: string, rating: number | null) {
  return {
    ...event,
    ...overrides,
    attendance: [{ id: 'att', status, user_id: 'u1', rating, review: null }],
  } as EventWithAttendance
}

function renderNormal(daysUntil: number) {
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

describe('HomeHero — la mañana después', () => {
  const lastNight = withAttendance({ id: 'ln', date: '2026-06-14' }, 'went', null)

  it('pregunta cómo estuvo y ofrece puntuar en un toque', () => {
    render(<HomeHero state={{ kind: 'morning-after', event: lastNight }} backgroundImage={null} />)

    expect(screen.getByText('Anoche · sin puntuar')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Cómo.*estuvo/)
    const score = screen.getByRole('group', { name: 'Puntaje del show' })
    expect(within(score).getAllByRole('button')).toHaveLength(5)
  })

  it('lo que queda de anoche apunta a la reseña y al gasto de ese show', () => {
    render(<HomeHero state={{ kind: 'morning-after', event: lastNight }} backgroundImage={null} />)

    expect(screen.getByRole('link', { name: /escribir la reseña/i })).toHaveAttribute('href', '/events/ln')
    expect(screen.getByRole('link', { name: /cargar el gasto/i })).toHaveAttribute('href', '/events/ln/gastos')
  })
})

describe('HomeHero — sólo pasado', () => {
  const past = withAttendance({ date: '2025-06-15' }, 'went', 5)

  it('abre con la efeméride y el puntaje que le puso', () => {
    render(<HomeHero state={{ kind: 'past-only', event: past, yearsAgo: 1 }} backgroundImage={null} />)

    expect(screen.getByText('Hace un año, hoy')).toBeInTheDocument()
    expect(screen.getByText(/le pusiste 5\/5/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Divididos')
    expect(screen.getByRole('link', { name: /ver ese show/i })).toHaveAttribute('href', '/events/e1')
  })

  it('con más de un año de distancia lo dice en plural', () => {
    render(<HomeHero state={{ kind: 'past-only', event: past, yearsAgo: 3 }} backgroundImage={null} />)
    expect(screen.getByText('Hace 3 años, hoy')).toBeInTheDocument()
  })

  it('sin efeméride no la inventa: es lo último que vio', () => {
    render(<HomeHero state={{ kind: 'past-only', event: past, yearsAgo: null }} backgroundImage={null} />)
    expect(screen.getByText('Lo último que viste')).toBeInTheDocument()
    expect(screen.queryByText(/hoy$/)).not.toBeInTheDocument()
  })

  it('sin puntaje no muestra un "le pusiste" vacío', () => {
    const unrated = withAttendance({ date: '2025-06-15' }, 'went', null)
    render(<HomeHero state={{ kind: 'past-only', event: unrated, yearsAgo: 1 }} backgroundImage={null} />)
    expect(screen.queryByText(/le pusiste/i)).not.toBeInTheDocument()
  })
})

describe('HomeHero — primera vez', () => {
  it('no es un vacío: talón sin emitir y "empezá por el último que viste"', () => {
    render(<HomeHero state={{ kind: 'first-time' }} backgroundImage={null} />)

    expect(screen.getByText('Talón Nº 0000001')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Empezá por/)
    expect(screen.queryByText(/todavía no hay/i)).not.toBeInTheDocument()
  })

  it('cada semilla busca los shows de ese artista', () => {
    render(<HomeHero state={{ kind: 'first-time' }} backgroundImage={null} />)
    expect(screen.getByRole('link', { name: 'Divididos' })).toHaveAttribute('href', '/buscar?artist=Divididos')
  })

  it('en desktop las dos salidas quedan en el flujo', () => {
    render(<HomeHero state={{ kind: 'first-time' }} backgroundImage={null} />)
    expect(screen.getByRole('link', { name: 'Buscar mi primer show' })).toHaveAttribute('href', '/buscar')
    expect(screen.getByRole('link', { name: 'Cargarlo a mano' })).toHaveAttribute('href', '/events/nuevo')
  })
})

describe('HomeHero — sin sesión', () => {
  it('muestra el próximo show del catálogo y la puerta de entrada', () => {
    render(<HomeHero state={{ kind: 'guest', event }} backgroundImage={null} />)

    expect(screen.getByText('Se viene')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Divididos')
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login')
    expect(screen.getByText(/colección vacía/i)).toBeInTheDocument()
  })

  it('sin nada en el catálogo no inventa un show', () => {
    render(<HomeHero state={{ kind: 'guest', event: undefined }} backgroundImage={null} />)

    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(screen.getByText(/colección vacía/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Entrar' })).toBeInTheDocument()
  })
})

describe('HomeHero — mobile (#82)', () => {
  it('el CTA hoisted del talón mobile abre el mismo talón que el botón de escritorio', () => {
    render(
      <MobileActionProvider>
        <HomeHero state={{ kind: 'normal', nextShow: event, daysUntil: 12 }} backgroundImage={null} />
        <MobileTabBar />
      </MobileActionProvider>
    )

    expect(screen.queryAllByText('Entrada válida')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir mi entrada' }))
    // El talón vive una vez por breakpoint (desktop `hidden md:block`, mobile
    // `md:hidden`): jsdom no evalúa media queries, así que ambas instancias
    // quedan en el DOM — sólo una es visible según el ancho real.
    expect(screen.getAllByText('Entrada válida').length).toBeGreaterThan(0)
  })

  it('initialOpen muestra el talón ya abierto al montar', () => {
    render(
      <HomeHero state={{ kind: 'show-today', event }} backgroundImage={null} initialOpen />
    )

    expect(screen.getAllByText('Entrada válida').length).toBeGreaterThan(0)
  })

  it('el botón de cerrar crece a 44px en mobile y vuelve a su tamaño en desktop', () => {
    render(<HomeHero state={{ kind: 'show-today', event }} backgroundImage={null} initialOpen />)

    const closeButtons = screen.getAllByRole('button', { name: /cerrar/i })
    expect(closeButtons.length).toBeGreaterThan(0)
    for (const closeButton of closeButtons) {
      expect(closeButton.className).toContain('min-h-[44px]')
      expect(closeButton.className).toContain('md:min-h-0')
    }
  })

  it('la sección de escritorio queda oculta en mobile', () => {
    const { container } = renderNormal(12)
    const section = container.querySelector('section')
    expect(section?.className).toContain('hidden')
    expect(section?.className).toContain('md:block')
  })

  it('hay un único CTA "Abrir mi entrada" — el del escritorio dice distinto ("ABRIR MI ENTRADA")', () => {
    render(
      <MobileActionProvider>
        <HomeHero state={{ kind: 'normal', nextShow: event, daysUntil: 12 }} backgroundImage={null} />
        <MobileTabBar />
      </MobileActionProvider>
    )

    expect(screen.getAllByRole('button', { name: 'Abrir mi entrada' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'ABRIR MI ENTRADA' })).toBeInTheDocument()
  })
})

describe('HomeHero — scroll snap', () => {
  it.each([
    ['normal', { kind: 'normal', nextShow: event, daysUntil: 12 }],
    ['show-today', { kind: 'show-today', event }],
    ['la mañana después', { kind: 'morning-after', event }],
    ['sólo pasado', { kind: 'past-only', event, yearsAgo: null }],
    ['primera vez', { kind: 'first-time' }],
    ['sin sesión', { kind: 'guest', event }],
  ] as const)('la sección engancha el scroll en el estado %s', (_label, state) => {
    const { container } = render(<HomeHero state={state as never} backgroundImage={null} />)
    const section = container.querySelector('section')
    expect(section?.className).toContain('snap-start')
  })
})
