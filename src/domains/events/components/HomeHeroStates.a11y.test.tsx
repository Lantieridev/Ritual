// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { HomeHero } from '@/src/domains/events/components/HomeHero'
import { MorningAfterScore } from '@/src/domains/events/components/MorningAfterScore'
import type { EventWithAttendance } from '@/src/domains/events/service'
import * as attendanceActions from '@/src/domains/events/attendance-actions'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/src/domains/events/attendance-actions', () => ({ saveMemory: vi.fn(async () => ({})) }))

const sampleEvent: EventWithAttendance = {
  id: 'e1',
  name: 'Show en Obras',
  date: '2026-12-24',
  venue_id: 'v1',
  venues: { name: 'Estadio Obras', city: 'CABA', country: 'AR' },
  lineups: [{ artists: { id: 'a1', name: 'Divididos', genre: 'Rock' }, is_headliner: true }],
  attendance: [{ id: 'att1', status: 'went', user_id: 'u1', rating: 5, review: null }],
} as unknown as EventWithAttendance

describe('HomeHeroStates — Accessibility (A11y)', () => {
  describe('Encabezados (h1) y títulos no vacíos', () => {
    it('estado "festival": tiene exactamente un h1 no vacío', () => {
      render(
        <HomeHero
          state={{
            kind: 'festival',
            festival: { id: 'f1', name: 'Cosquín Rock 2026', start_date: '2026-02-14', end_date: '2026-02-15' } as never,
          }}
          backgroundImage={null}
        />
      )
      const h1s = screen.getAllByRole('heading', { level: 1 })
      expect(h1s).toHaveLength(1)
      expect(h1s[0].textContent?.trim()).toBe('Cosquín Rock 2026')
    })

    // "show-today"/"normal" (#82) renderizan un h1 por breakpoint —
    // escritorio (`hidden md:block`) y mobile (`md:hidden`) — para que cada
    // uno tenga su propia estructura (sin talón 3D ni butaca en mobile).
    // jsdom no evalúa esas media queries (no hay motor de layout real), así
    // que ambos quedan en el árbol de accesibilidad acá; en un navegador
    // real sólo uno es visible a la vez — ese "exactamente uno" lo cubre
    // e2e (Playwright), que sí corre con CSS real.
    it('estado "show-today": el h1 de escritorio y el de mobile no están vacíos y coinciden', () => {
      render(<HomeHero state={{ kind: 'show-today', event: sampleEvent }} backgroundImage={null} />)
      const h1s = screen.getAllByRole('heading', { level: 1 })
      expect(h1s).toHaveLength(2)
      for (const h1 of h1s) {
        expect(h1.textContent?.trim().length).toBeGreaterThan(0)
      }
      expect(h1s[0].textContent?.trim()).toBe(h1s[1].textContent?.trim())
    })

    it('estado "normal": el h1 de escritorio y el de mobile no están vacíos y coinciden', () => {
      render(
        <HomeHero
          state={{ kind: 'normal', nextShow: sampleEvent, daysUntil: 12 }}
          backgroundImage={null}
        />
      )
      const h1s = screen.getAllByRole('heading', { level: 1 })
      expect(h1s).toHaveLength(2)
      for (const h1 of h1s) {
        expect(h1.textContent?.trim().length).toBeGreaterThan(0)
      }
      expect(h1s[0].textContent?.trim()).toBe(h1s[1].textContent?.trim())
    })

    it('estado "morning-after": tiene exactamente un h1 no vacío', () => {
      render(<HomeHero state={{ kind: 'morning-after', event: sampleEvent }} backgroundImage={null} />)
      const h1s = screen.getAllByRole('heading', { level: 1 })
      expect(h1s).toHaveLength(1)
      expect(h1s[0].textContent?.trim().length).toBeGreaterThan(0)
    })

    it('estado "past-only": tiene exactamente un h1 no vacío', () => {
      render(<HomeHero state={{ kind: 'past-only', event: sampleEvent, yearsAgo: 1 }} backgroundImage={null} />)
      const h1s = screen.getAllByRole('heading', { level: 1 })
      expect(h1s).toHaveLength(1)
      expect(h1s[0].textContent?.trim()).toBe('Divididos')
    })

    it('estado "first-time": tiene exactamente un h1 no vacío', () => {
      render(<HomeHero state={{ kind: 'first-time' }} backgroundImage={null} />)
      const h1s = screen.getAllByRole('heading', { level: 1 })
      expect(h1s).toHaveLength(1)
      expect(h1s[0].textContent?.trim().length).toBeGreaterThan(0)
    })

    it('estado "guest" con show: tiene exactamente un h1 no vacío', () => {
      render(<HomeHero state={{ kind: 'guest', event: sampleEvent }} backgroundImage={null} />)
      const h1s = screen.getAllByRole('heading', { level: 1 })
      expect(h1s).toHaveLength(1)
      expect(h1s[0].textContent?.trim()).toBe('Divididos')
    })

    it('estado "guest" sin show: no tiene h1 (no inventa un show)', () => {
      render(<HomeHero state={{ kind: 'guest', event: undefined }} backgroundImage={null} />)
      expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(0)
    })

    it('todos los encabezados de la página tienen texto accesible no vacío', () => {
      render(<HomeHero state={{ kind: 'morning-after', event: sampleEvent }} backgroundImage={null} />)
      const headings = screen.getAllByRole('heading')
      for (const h of headings) {
        expect(h.textContent?.trim().length).toBeGreaterThan(0)
      }
    })
  })

  describe('Nombres accesibles en enlaces y botones', () => {
    it.each([
      ['festival', { kind: 'festival', festival: { id: 'f1', name: 'Festival', start_date: '2026-02-14' } }],
      ['show-today', { kind: 'show-today', event: sampleEvent }],
      ['normal', { kind: 'normal', nextShow: sampleEvent, daysUntil: 5 }],
      ['morning-after', { kind: 'morning-after', event: sampleEvent }],
      ['past-only', { kind: 'past-only', event: sampleEvent, yearsAgo: 2 }],
      ['first-time', { kind: 'first-time' }],
      ['guest', { kind: 'guest', event: sampleEvent }],
    ] as const)('en el estado %s, cada link y botón posee un nombre accesible no vacío', (_label, state) => {
      const { container } = render(<HomeHero state={state as never} backgroundImage={null} />)
      const linksAndButtons = container.querySelectorAll('a, button')
      expect(linksAndButtons.length).toBeGreaterThan(0)

      for (const el of Array.from(linksAndButtons)) {
        const ariaLabel = el.getAttribute('aria-label')
        const text = el.textContent?.trim()
        const title = el.getAttribute('title')
        const accessibleName = ariaLabel || text || title || ''
        expect(accessibleName.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Elementos decorativos marcados con aria-hidden', () => {
    it('oculta el contador de días gigante en el estado normal', () => {
      const { container } = render(
        <HomeHero state={{ kind: 'normal', nextShow: sampleEvent, daysUntil: 42 }} backgroundImage={null} />
      )
      const counter = Array.from(container.querySelectorAll('div')).find((d) => d.textContent?.trim() === '42')
      expect(counter).toHaveAttribute('aria-hidden', 'true')
    })

    it('oculta las flechas decorativas de dirección e indicadores', () => {
      const { container } = render(
        <HomeHero state={{ kind: 'normal', nextShow: sampleEvent, daysUntil: 10 }} backgroundImage={null} />
      )
      const arrow = Array.from(container.querySelectorAll('span')).find((s) => s.textContent?.trim() === '↓')
      expect(arrow).toHaveAttribute('aria-hidden', 'true')
    })

    it('oculta el talón sin emitir en el estado primera vez', () => {
      render(<HomeHero state={{ kind: 'first-time' }} backgroundImage={null} />)
      const ticketText = screen.getByText('SIN EMITIR')
      const ticketContainer = ticketText.closest('div[aria-hidden="true"]')
      expect(ticketContainer).not.toBeNull()
      expect(ticketContainer).toHaveAttribute('aria-hidden', 'true')
    })

    it('oculta el signo + en las semillas de artistas en primera vez', () => {
      const { container } = render(<HomeHero state={{ kind: 'first-time' }} backgroundImage={null} />)
      const plusSigns = Array.from(container.querySelectorAll('span')).filter((s) => s.textContent?.trim() === '+')
      expect(plusSigns.length).toBeGreaterThan(0)
      for (const plus of plusSigns) {
        expect(plus).toHaveAttribute('aria-hidden', 'true')
      }
    })
  })

  describe('MorningAfterScore — Estructura accesible y estados', () => {
    it('tiene role="group" con la etiqueta accesible "Puntaje del show"', () => {
      render(<MorningAfterScore eventId="e1" />)
      const group = screen.getByRole('group', { name: 'Puntaje del show' })
      expect(group).toBeInTheDocument()
    })

    it('expone aria-pressed en los 5 botones del grupo', () => {
      render(<MorningAfterScore eventId="e1" />)
      const group = screen.getByRole('group', { name: 'Puntaje del show' })
      const buttons = within(group).getAllByRole('button')
      expect(buttons).toHaveLength(5)

      for (const btn of buttons) {
        expect(btn).toHaveAttribute('aria-pressed')
        expect(btn.getAttribute('aria-pressed')).toBe('false')
      }
    })

    it('actualiza aria-pressed a true en el botón seleccionado al hacer click', () => {
      render(<MorningAfterScore eventId="e1" />)
      const group = screen.getByRole('group', { name: 'Puntaje del show' })
      const buttons = within(group).getAllByRole('button')

      fireEvent.click(buttons[3]) // botón con score 4
      expect(buttons[3]).toHaveAttribute('aria-pressed', 'true')
      expect(buttons[0]).toHaveAttribute('aria-pressed', 'false')
    })

    it('muestra los errores con role="alert"', async () => {
      vi.spyOn(attendanceActions, 'saveMemory').mockResolvedValueOnce({ error: 'Error al guardar puntaje' } as never)

      render(<MorningAfterScore eventId="e1" />)
      const group = screen.getByRole('group', { name: 'Puntaje del show' })
      const buttons = within(group).getAllByRole('button')

      fireEvent.click(buttons[2])

      const alert = await screen.findByRole('alert')
      expect(alert).toBeInTheDocument()
      expect(alert).toHaveTextContent('Error al guardar puntaje')
    })
  })

  describe('Ausencia de tabindex positivo', () => {
    it.each([
      ['festival', { kind: 'festival', festival: { id: 'f1', name: 'Festival', start_date: '2026-02-14' } }],
      ['show-today', { kind: 'show-today', event: sampleEvent }],
      ['normal', { kind: 'normal', nextShow: sampleEvent, daysUntil: 5 }],
      ['morning-after', { kind: 'morning-after', event: sampleEvent }],
      ['past-only', { kind: 'past-only', event: sampleEvent, yearsAgo: 2 }],
      ['first-time', { kind: 'first-time' }],
      ['guest', { kind: 'guest', event: sampleEvent }],
    ] as const)('no existen elementos con tabindex > 0 en el estado %s', (_label, state) => {
      const { container } = render(<HomeHero state={state as never} backgroundImage={null} />)
      const elementsWithTabIndex = container.querySelectorAll('[tabindex]')

      for (const el of Array.from(elementsWithTabIndex)) {
        const val = parseInt(el.getAttribute('tabindex') || '0', 10)
        expect(val).toBeLessThanOrEqual(0)
      }
    })
  })
})
