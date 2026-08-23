import { describe, it, expect } from 'vitest'
import {
  CHORIPAN_REFERENCE_PRICE_ARS,
  amountInChoripanes,
  formatChoripanComparison,
  INDEC_ANNUAL_INFLATION_PCT,
  adjustForInflation,
} from '@/src/domains/expenses/comparisons'

describe('amountInChoripanes', () => {
  it('divides the amount by the reference choripán price', () => {
    expect(amountInChoripanes(CHORIPAN_REFERENCE_PRICE_ARS * 10)).toBe(10)
  })

  it('returns 0 for a zero, negative, or non-finite amount', () => {
    expect(amountInChoripanes(0)).toBe(0)
    expect(amountInChoripanes(-100)).toBe(0)
    expect(amountInChoripanes(NaN)).toBe(0)
  })
})

describe('formatChoripanComparison', () => {
  it('rounds to one decimal below 10 choripanes', () => {
    expect(formatChoripanComparison(CHORIPAN_REFERENCE_PRICE_ARS * 1.5)).toBe('esto son 1,5 choripanes')
  })

  it('uses the singular for exactly one choripán', () => {
    expect(formatChoripanComparison(CHORIPAN_REFERENCE_PRICE_ARS)).toBe('esto son 1 choripán')
  })

  it('rounds to whole units at or above 10 choripanes', () => {
    expect(formatChoripanComparison(CHORIPAN_REFERENCE_PRICE_ARS * 40.4)).toBe('esto son 40 choripanes')
  })

  it('returns null for a non-positive amount', () => {
    expect(formatChoripanComparison(0)).toBeNull()
    expect(formatChoripanComparison(-50)).toBeNull()
  })
})

describe('adjustForInflation', () => {
  it('returns null for an expense dated in the current year (nothing to adjust at annual granularity)', () => {
    const result = adjustForInflation(1000, '2026-03-01', new Date('2026-08-23'))
    expect(result).toBeNull()
  })

  it('returns null for a future-dated expense', () => {
    const result = adjustForInflation(1000, '2027-01-01', new Date('2026-08-23'))
    expect(result).toBeNull()
  })

  it('compounds each full year plus the partial current year, in order', () => {
    const result = adjustForInflation(1000, '2023-06-01', new Date('2026-08-23'))

    expect(result).not.toBeNull()
    const expectedMultiplier =
      (1 + INDEC_ANNUAL_INFLATION_PCT[2024] / 100) *
      (1 + INDEC_ANNUAL_INFLATION_PCT[2025] / 100) *
      (1 + INDEC_ANNUAL_INFLATION_PCT[2026] / 100)
    expect(result!.multiplier).toBeCloseTo(expectedMultiplier, 10)
    expect(result!.adjustedAmount).toBeCloseTo(1000 * expectedMultiplier, 6)
    expect(result!.fromYear).toBe(2023)
    expect(result!.toYear).toBe(2026)
  })

  it('adjusts a one-year-old expense by exactly that year\'s rate', () => {
    const result = adjustForInflation(1000, '2025-01-01', new Date('2026-08-23'))

    expect(result!.multiplier).toBeCloseTo(1 + INDEC_ANNUAL_INFLATION_PCT[2026] / 100, 10)
  })

  it('returns null instead of guessing when a year in range is not in the table yet', () => {
    const result = adjustForInflation(1000, '2023-01-01', new Date('2030-01-01'))
    expect(result).toBeNull()
  })

  it('returns null for a non-positive amount', () => {
    expect(adjustForInflation(0, '2023-01-01', new Date('2026-08-23'))).toBeNull()
    expect(adjustForInflation(-500, '2023-01-01', new Date('2026-08-23'))).toBeNull()
  })
})
