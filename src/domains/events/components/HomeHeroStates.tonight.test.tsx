// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { Suspense } from 'react'
import { render, screen, act } from '@testing-library/react'
import { TonightMobileHero, TonightMeta, RecentSeenList } from '@/src/domains/events/components/HomeHeroStates'
import type { EventWithAttendance } from '@/src/domains/events/service'
import type { EventWeather } from '@/src/domains/weather/weather-service'
import type { HeroVenueDetails } from '@/src/domains/events/hero-details'

/**
 * El hero mobile de "hoy" (show-today/normal, #82): badge de hora, sin
 * etiqueta de butaca (Ritual no tiene esa data), degradación honesta de
 * dirección/clima y la lista "Lo último que viste". Portado 1:1 del
 * prototipo (.design-reference/Ritual Mobile.dc.html), sin desktop de por
 * medio — HomeHero.tsx recién los cablea en WU2b.
 */

const baseEvent: EventWithAttendance = {
  id: 'e1',
  name: 'Show en Obras',
  date: '2026-06-15T21:00:00-03:00',
  venue_id: 'v1',
  venues: { name: 'Estadio Obras', city: 'CABA', country: 'AR' },
  lineups: [{ artists: { id: 'a1', name: 'Dillom', genre: 'Rap' }, is_headliner: true }],
} as unknown as EventWithAttendance

function makeWeather(overrides: Partial<EventWeather> = {}): EventWeather {
  return {
    temperatureC: 18,
    precipitationMm: 0,
    weatherCode: 0,
    isRain: false,
    description: 'Despejado',
    hourLabel: '21:00',
    ...overrides,
  }
}

describe('TonightMobileHero', () => {
  it('show-today: muestra el badge "Esta noche · HH:MM", el headliner y la sede — sin butaca', () => {
    render(
      <TonightMobileHero
        state={{ kind: 'show-today', event: baseEvent }}
        image={null}
        details={null}
      />
    )

    expect(screen.getByText('Esta noche · 21:00')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dillom')
    expect(screen.getByText('Estadio Obras')).toBeInTheDocument()
    expect(screen.queryByText(/campo general/i)).not.toBeInTheDocument()
  })

  it('normal: el badge muestra la fecha formateada y la hora, no "Esta noche"', () => {
    const nextShow = { ...baseEvent, date: '2026-06-20T19:30:00-03:00' }
    render(
      <TonightMobileHero
        state={{ kind: 'normal', nextShow, daysUntil: 5 }}
        image={null}
        details={null}
      />
    )

    expect(screen.getByText('20 jun · 19:30')).toBeInTheDocument()
    expect(screen.queryByText(/esta noche/i)).not.toBeInTheDocument()
  })

  it('aplica el tratamiento de foto de marca cuando hay imagen', () => {
    const { container } = render(
      <TonightMobileHero state={{ kind: 'show-today', event: baseEvent }} image="https://x/y.jpg" details={null} />
    )
    const foto = container.querySelector('.ritual-photo')
    expect(foto?.className).toContain('ritual-photo-bg')
  })
})

/*
 * WU3 (#82/#8, R1-008): `details` puede llegar como Promise (dirección y
 * clima resueltos por `getHeroVenueDetails`) — el resto del hero (foto,
 * badge, headliner, sede) nunca debe esperarla. `TonightMobileHero` la
 * resuelve en su propio `<Suspense fallback={null}>`, así que el Suspense
 * exterior (el de `HomeHero`/Home) nunca cae en fallback por su culpa.
 */
describe('TonightMobileHero — details como Promise (#82, R1-008)', () => {
  it('no bloquea el resto del hero mientras la promesa de dirección/clima está pendiente', async () => {
    let resolveDetails!: (v: HeroVenueDetails) => void
    const pending = new Promise<HeroVenueDetails>((resolve) => {
      resolveDetails = resolve
    })

    await act(async () => {
      render(
        <Suspense fallback={<div data-testid="outer-fallback" />}>
          <TonightMobileHero state={{ kind: 'show-today', event: baseEvent }} image={null} details={pending} />
        </Suspense>
      )
    })

    // El resto del hero ya está en pantalla — no espera al clima.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dillom')
    expect(screen.getByText('Estadio Obras')).toBeInTheDocument()
    expect(screen.queryByTestId('outer-fallback')).not.toBeInTheDocument()
    expect(screen.queryByText('Humboldt 450')).not.toBeInTheDocument()

    await act(async () => {
      resolveDetails({ address: 'Humboldt 450', weather: null })
      await pending
    })

    expect(screen.getByText('Humboldt 450')).toBeInTheDocument()
  })
})

describe('TonightMeta', () => {
  it('sin address ni weather no renderiza nada', () => {
    const { container } = render(<TonightMeta details={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('sin address (venue sin dirección) omite la línea entera', () => {
    render(<TonightMeta details={{ address: null, weather: makeWeather() }} />)
    expect(screen.queryByText(/humboldt/i)).not.toBeInTheDocument()
    expect(screen.getByText('no llueve')).toBeInTheDocument()
  })

  it('sin weather (sede sin lat/lng) omite el tag de clima', () => {
    render(<TonightMeta details={{ address: 'Humboldt 450', weather: null }} />)
    expect(screen.getByText('Humboldt 450')).toBeInTheDocument()
    expect(screen.queryByText(/llueve/i)).not.toBeInTheDocument()
  })

  it('con ambos presentes renderiza los dos con un separador aria-hidden entre medio', () => {
    const { container } = render(
      <TonightMeta details={{ address: 'Humboldt 450', weather: makeWeather({ isRain: true }) }} />
    )
    expect(screen.getByText('Humboldt 450')).toBeInTheDocument()
    expect(screen.getByText('llueve')).toBeInTheDocument()
    const sep = Array.from(container.querySelectorAll('span')).find((s) => s.textContent === '·')
    expect(sep).toHaveAttribute('aria-hidden', 'true')
  })
})

function attendance(status: string, rating: number | null) {
  return [{ id: 'a1', status, user_id: 'u1', rating, review: null }]
}

describe('RecentSeenList', () => {
  it('con 3 shows, 2 puntuados y 1 sin puntaje: sólo esos 2 muestran el score', () => {
    const events = [
      { ...baseEvent, id: 'a', name: 'Show A', lineups: [{ artists: { id: 'x', name: 'Show A', genre: 'Rock' }, is_headliner: true }], attendance: attendance('went', 4) },
      { ...baseEvent, id: 'b', name: 'Show B', lineups: [{ artists: { id: 'y', name: 'Show B', genre: 'Rock' }, is_headliner: true }], attendance: attendance('went', 5) },
      { ...baseEvent, id: 'c', name: 'Show C', lineups: [{ artists: { id: 'z', name: 'Show C', genre: 'Rock' }, is_headliner: true }], attendance: attendance('went', null) },
    ] as unknown as EventWithAttendance[]

    render(<RecentSeenList events={events} />)

    expect(screen.getByText('Lo último que viste')).toBeInTheDocument()
    expect(screen.getByText('4/5')).toBeInTheDocument()
    expect(screen.getByText('5/5')).toBeInTheDocument()
    expect(screen.getAllByText(/\/5$/)).toHaveLength(2)
  })

  it('con menos de 3 shows sólo renderiza esos, sin placeholders', () => {
    const events = [
      { ...baseEvent, id: 'only', attendance: attendance('went', 3) },
    ] as unknown as EventWithAttendance[]

    render(<RecentSeenList events={events} />)
    expect(screen.getAllByText('Dillom')).toHaveLength(1)
  })

  it('sin shows vistos, la sección entera se omite', () => {
    const { container } = render(<RecentSeenList events={[]} />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByText('Lo último que viste')).not.toBeInTheDocument()
  })
})
