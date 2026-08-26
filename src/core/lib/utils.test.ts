import { describe, it, expect } from 'vitest'
import { cn, formatDate } from '@/src/core/lib/utils'

describe('cn', () => {
  it('joins multiple class strings', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, '', 'b')).toBe('a b')
  })

  it('merges conflicting Tailwind classes, keeping the last one', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('supports conditional object syntax', () => {
    expect(cn('base', { active: true, hidden: false })).toBe('base active')
  })
})

describe('formatDate', () => {
  // formatDate muestra los timestamps en la zona de la app (Argentina, UTC-3),
  // no en la del runtime, así que el instante se fija de forma explícita en vez
  // de construirlo con componentes locales: con `new Date(2026, 2, 15)` el
  // resultado dependía de la zona de la máquina y el test pasaba local pero
  // fallaba en CI, que corre en UTC.
  //
  // 15:00 UTC son las 12:00 del 15 de marzo en Argentina — mediodía, lejos de
  // cualquier borde de día.
  const localDate = new Date('2026-03-15T15:00:00Z')

  it('formats a Date with the default long options', () => {
    expect(formatDate(localDate)).toBe('15 de marzo de 2026')
  })

  it('formats a date string the same as the equivalent Date object', () => {
    expect(formatDate(localDate.toISOString())).toBe(formatDate(localDate))
  })

  it('accepts custom Intl.DateTimeFormatOptions', () => {
    expect(formatDate(localDate, { month: 'short' })).toBe('mar')
  })
})

// Regresión del corrimiento de día en las columnas `date` de Postgres:
// `expenses.date` guarda "2026-05-26" y la UI mostraba "25 may", porque el
// string pelado se parsea como medianoche UTC y al formatear en horario de
// Argentina (UTC-3) retrocede al día anterior.
describe('formatDate con fechas sin hora', () => {
    it('conserva el día calendario de un "YYYY-MM-DD"', () => {
        expect(formatDate('2026-05-26', { day: 'numeric', month: 'short' })).toBe('26 may')
    })

    it('no retrocede en el primer día del mes', () => {
        expect(formatDate('2026-01-01', { day: 'numeric', month: 'long', year: 'numeric' }))
            .toBe('1 de enero de 2026')
    })

    // Un timestamp sí es un instante y se muestra en la zona de la app, no en
    // la del runtime: 02:00 UTC son las 23:00 del día anterior en Argentina.
    // Este test corría distinto en CI (UTC) que en la máquina local (ART) hasta
    // que formatDate pasó a fijar la timezone explícitamente.
    it('muestra un timestamp en la zona de la app, no en la del servidor', () => {
        expect(formatDate('2026-05-26T02:00:00Z', { day: 'numeric', month: 'short' })).toBe('25 may')
    })

    it('no corre el día de un timestamp del mediodía', () => {
        expect(formatDate('2026-05-26T15:00:00Z', { day: 'numeric', month: 'short' })).toBe('26 may')
    })
})
