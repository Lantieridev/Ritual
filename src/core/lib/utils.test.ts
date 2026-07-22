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
