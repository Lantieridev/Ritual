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
  // new Date('YYYY-MM-DD') parses as UTC midnight, which reads back as the
  // previous day in a timezone behind UTC (like the test runner's local
  // zone here) — construct with explicit local components to avoid that,
  // same lesson as core/lib/dates.ts.
  const localDate = new Date(2026, 2, 15) // 15 de marzo de 2026, hora local

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

    it('sigue respetando la hora cuando el string sí la trae', () => {
        // 2026-05-26T02:00:00Z son las 23:00 del 25 en Argentina.
        expect(formatDate('2026-05-26T02:00:00Z', { day: 'numeric', month: 'short' })).toBe('25 may')
    })
})
