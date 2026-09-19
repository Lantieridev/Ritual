import { describe, it, expect } from 'vitest'
import { pickShowTonight, bandaLinkFor, type ShowTonightRow, type ShowTonight } from '@/src/domains/events/show-tonight'
import { routes } from '@/src/core/lib/routes'

/**
 * Selección pura del show de "esta noche" (issue #82) a partir de filas de
 * `attendance` ya acotadas por la query (user_id, status='going') — ver
 * getShowTonight en data.ts. `bandaLinkFor` arma el link server-safe que
 * consume MobileTabBar (R1-004/R1-007).
 */
function makeRow(overrides: Partial<NonNullable<ShowTonightRow['events']>> & { date: string }): ShowTonightRow {
  return {
    status: 'going',
    events: {
      id: 'e1',
      name: null,
      lineups: null,
      ...overrides,
    },
  }
}

describe('pickShowTonight', () => {
  const NOW = new Date('2026-07-21T15:00:00Z') // 2026-07-21 12:00 ART

  it('descarta filas con events null', () => {
    const rows: ShowTonightRow[] = [{ status: 'going', events: null }]
    expect(pickShowTonight(rows, NOW)).toBeNull()
  })

  it('descarta filas malformadas (date no es un string)', () => {
    const rows: ShowTonightRow[] = [
      { status: 'going', events: { id: 'e1', name: 'Show', date: null as unknown as string, lineups: null } },
    ]
    expect(pickShowTonight(rows, NOW)).toBeNull()
  })

  it('descarta shows que no son hoy', () => {
    const rows = [makeRow({ id: 'e1', date: '2026-07-20T21:00:00-03:00' })]
    expect(pickShowTonight(rows, NOW)).toBeNull()
  })

  it('gana el más temprano cuando hay más de un show hoy', () => {
    const rows = [
      makeRow({ id: 'late', date: '2026-07-21T23:00:00-03:00' }),
      makeRow({ id: 'early', date: '2026-07-21T18:00:00-03:00' }),
    ]
    expect(pickShowTonight(rows, NOW)?.id).toBe('early')
  })

  it('respeta el límite del día calendario en Argentina, no UTC (frontera 02:30Z / 03:30Z)', () => {
    // 2026-07-22T02:30:00Z = 2026-07-21 23:30 ART → sigue siendo "hoy".
    const stillTonight = [makeRow({ id: 'still-tonight', date: '2026-07-22T02:30:00Z' })]
    expect(pickShowTonight(stillTonight, NOW)?.id).toBe('still-tonight')

    // 2026-07-22T03:30:00Z = 2026-07-22 00:30 ART → ya es mañana.
    const alreadyTomorrow = [makeRow({ id: 'tomorrow', date: '2026-07-22T03:30:00Z' })]
    expect(pickShowTonight(alreadyTomorrow, NOW)).toBeNull()
  })

  it('usa el nombre del lineup, y si no hay ninguno cae al nombre del evento', () => {
    const withLineup = [
      makeRow({ id: 'e1', date: '2026-07-21T21:00:00-03:00', name: 'Ignorado', lineups: [{ artists: { name: 'Bandalos Chinos' } }] }),
    ]
    expect(pickShowTonight(withLineup, NOW)?.headliner).toBe('Bandalos Chinos')

    const withoutLineup = [makeRow({ id: 'e2', date: '2026-07-21T21:00:00-03:00', name: 'Show sin lineup', lineups: null })]
    expect(pickShowTonight(withoutLineup, NOW)?.headliner).toBe('Show sin lineup')
  })

  it('cae a "Recital" cuando no hay lineup ni nombre', () => {
    const rows = [makeRow({ id: 'e1', date: '2026-07-21T21:00:00-03:00', name: null, lineups: null })]
    expect(pickShowTonight(rows, NOW)?.headliner).toBe('Recital')
  })

  it('devuelve null cuando no hay filas', () => {
    expect(pickShowTonight([], NOW)).toBeNull()
  })

  it('propaga time_known como timeKnown, y una fila sin el flag cuenta como hora conocida', () => {
    const unknown = pickShowTonight([makeRow({ id: 'e1', date: '2026-07-21T00:00:00-03:00', time_known: false })], NOW)
    const legacy = pickShowTonight([makeRow({ id: 'e2', date: '2026-07-21T21:00:00-03:00' })], NOW)

    expect(unknown?.timeKnown).toBe(false)
    expect(legacy?.timeKnown).toBe(true)
  })
})

describe('bandaLinkFor', () => {
  it('siempre apunta a routes.tonightTicket, sin funciones', () => {
    const show: ShowTonight = { id: 'e1', headliner: 'Divididos', date: '2026-07-21T21:00:00-03:00', timeKnown: true }
    const link = bandaLinkFor(show)

    expect(link.href).toBe(routes.tonightTicket)
    expect(link).toEqual({
      subtitle: 'Tu entrada de hoy',
      title: 'Divididos · 21:00',
      actionLabel: 'Abrir',
      href: routes.tonightTicket,
    })
    expect(Object.values(link).every((v) => typeof v !== 'function')).toBe(true)
  })

  it('omite la hora cuando la fecha no la trae (fecha bare, sin time-of-day)', () => {
    const show: ShowTonight = { id: 'e1', headliner: 'Divididos', date: '2026-07-21', timeKnown: true }
    const link = bandaLinkFor(show)

    expect(link.title).toBe('Divididos')
  })

  it('omite la hora cuando el show se guardó sin hora (time_known = false)', () => {
    const show: ShowTonight = { id: 'e1', headliner: 'Divididos', date: '2026-07-21T00:00:00-03:00', timeKnown: false }

    expect(bandaLinkFor(show).title).toBe('Divididos')
  })
})
