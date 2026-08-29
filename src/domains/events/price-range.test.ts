import { describe, it, expect } from 'vitest'
import { formatPriceRange } from './price-range'

describe('formatPriceRange', () => {
  it('returns null when there is no priceRange', () => {
    expect(formatPriceRange(undefined)).toBeNull()
  })

  it('formats a real range with the currency Ticketmaster reported', () => {
    const result = formatPriceRange({ min: 15000, max: 45000, currency: 'ARS' })
    expect(result).toContain('15.000')
    expect(result).toContain('45.000')
    expect(result).toContain('–')
  })

  it('collapses a single-value range (min === max) into one price, not a dash range', () => {
    const result = formatPriceRange({ min: 20000, max: 20000, currency: 'ARS' })
    expect(result).not.toContain('–')
  })

  it('formats a foreign currency correctly', () => {
    const result = formatPriceRange({ min: 50, max: 120, currency: 'USD' })
    expect(result).toMatch(/US\$|USD/)
  })

  it('returns null for a non-positive or non-finite min, instead of a nonsense "$0" range', () => {
    expect(formatPriceRange({ min: 0, max: 0, currency: 'ARS' })).toBeNull()
    expect(formatPriceRange({ min: NaN, max: 100, currency: 'ARS' })).toBeNull()
  })

  it('falls back to a plain number instead of throwing on a currency code Intl does not recognize', () => {
    const result = formatPriceRange({ min: 100, max: 200, currency: 'XXX-NOTREAL' })
    expect(result).toContain('100')
    expect(result).toContain('200')
  })
})
