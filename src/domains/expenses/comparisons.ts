/**
 * Spending comparisons with RITUAL's own identity — issue #7 explicitly
 * rejected comparing against USD/blue-dollar ("Ritual es una app de música,
 * no de finanzas"). Two comparisons instead:
 *  - How many choripanes/asados a given amount buys.
 *  - What a past expense is worth in today's purchasing power, using
 *    INDEC's published accumulated inflation.
 *
 * ============================================================================
 * MAINTENANCE — both reference values below WILL go stale. Read this before
 * touching either constant.
 * ============================================================================
 *
 * CHORIPAN_REFERENCE_PRICE_ARS
 *   Source: choripan.com.ar's 2026 Buenos Aires neighborhood price guide
 *   (https://choripan.com.ar/en/blog/choripan-prices-by-neighborhood-2026/),
 *   cross-checked against general market coverage, both retrieved
 *   2026-08-23. Prices in Buenos Aires ranged roughly $3.500–$12.000 ARS
 *   depending on venue (street cart vs. sit-down parrilla), with the guide's
 *   own "best price-quality ratio" sweet spot at $5.000–$5.500. $5.000 was
 *   picked as a round, defensible mid-market reference — closer to a
 *   recital food-truck/kiosco choripán than a restaurant one. Bump this
 *   number whenever it drifts noticeably from what a choripán actually
 *   costs; there is no live price feed behind it.
 *
 * INDEC_ANNUAL_INFLATION_PCT
 *   Source: INDEC's published IPC (Índice de Precios al Consumidor),
 *   compiled from https://estudiodelamo.com/inflacion-argentina-anual-mensual/
 *   and cross-checked against https://calcular.ar/inflacion/2026 and
 *   https://chequeado.com/inflacionacumulada/, retrieved 2026-08-23.
 *   Full calendar years (2018–2025) use INDEC's closed-year accumulated IPC.
 *   The CURRENT year is a moving target: its entry holds the accumulated IPC
 *   through the last verified month only (see the inline comment on that
 *   entry), not the full year — because the year isn't over yet. That means
 *   `adjustForInflation` will silently understate "today's" purchasing power
 *   the further the real date drifts past that verified month, since
 *   nothing here is wired to a live feed. Whoever maintains this app should:
 *     1. Update the current year's entry every month or two from INDEC's
 *        IPC report (indec.gob.ar → "Índice de precios al consumidor").
 *     2. Once INDEC publishes December's number, freeze that year's entry
 *        as final and add a new partial entry for the next year.
 *   Adjustment granularity is annual, not monthly — an expense from March
 *   2023 and one from November 2023 get the exact same multiplier. That's a
 *   deliberate simplification per issue #7 ("la versión más simple
 *   razonable"): this is a soft, fun comparison inside a music app, not a
 *   financial tool, so a month-by-month IPC series wasn't worth the extra
 *   upkeep burden.
 */
import { eventYear } from '@/src/core/lib/dates'

/** Reference price for one choripán, in ARS. See file header for sourcing. */
export const CHORIPAN_REFERENCE_PRICE_ARS = 5000

/** How many choripanes a given ARS amount buys, at the reference price. */
export function amountInChoripanes(amountArs: number): number {
  if (!Number.isFinite(amountArs) || amountArs <= 0) return 0
  return amountArs / CHORIPAN_REFERENCE_PRICE_ARS
}

/**
 * Renders the "esto son N choripanes" comparison, or null for a
 * non-positive/invalid amount. Rounds to one decimal below 10 choripanes
 * (so "$7.500" reads as "1,5 choripanes", not "2") and to whole units above
 * that, where a half-choripán stops being a meaningful distinction.
 */
export function formatChoripanComparison(amountArs: number): string | null {
  const count = amountInChoripanes(amountArs)
  if (count <= 0) return null
  const rounded = count >= 10 ? Math.round(count) : Math.round(count * 10) / 10
  const label = rounded === 1 ? 'choripán' : 'choripanes'
  return `esto son ${rounded.toLocaleString('es-AR')} ${label}`
}

/**
 * INDEC's published annual accumulated inflation (%) by calendar year. See
 * the file header — the current year's entry is a partial, moving target
 * and needs periodic updating.
 */
export const INDEC_ANNUAL_INFLATION_PCT: Record<number, number> = {
  2018: 47.65,
  2019: 53.83,
  2020: 36.15,
  2021: 50.93,
  2022: 94.79,
  2023: 211.41,
  2024: 117.76,
  2025: 31.55,
  // PARTIAL YEAR — accumulated IPC Jan-Jun 2026 only (last verified month as
  // of 2026-08-23). Update this as the year progresses; see file header.
  2026: 16.9,
}

export interface InflationAdjustment {
  /** The original amount, converted into the reference year's purchasing power. */
  adjustedAmount: number
  /** Compounded multiplier applied (adjustedAmount === amountArs * multiplier). */
  multiplier: number
  fromYear: number
  toYear: number
}

/**
 * Adjusts a past ARS amount to "today's" purchasing power by compounding
 * INDEC's published annual inflation year over year.
 *
 * Returns null rather than guessing when:
 *  - the expense is from the current year (annual granularity can't say
 *    anything meaningful about a few months' difference), or
 *  - any year in the range isn't in `INDEC_ANNUAL_INFLATION_PCT` yet (the
 *    table hasn't been updated that far) — silently applying a 0% rate for
 *    a missing year would understate the adjustment without any signal that
 *    it happened.
 */
export function adjustForInflation(
  amountArs: number,
  expenseDateIso: string,
  referenceDate: Date = new Date()
): InflationAdjustment | null {
  if (!Number.isFinite(amountArs) || amountArs <= 0) return null

  // expenseDateIso viene de expenses.date, una columna `date` de Postgres
  // sin hora ni timezone -sus dígitos SON la fecha, el slice es seguro acá.
  // referenceDate sí es un Date real (server/browser), y
  // referenceDate.getFullYear() leía la hora LOCAL del proceso -en Vercel
  // (UTC) el 31 de diciembre a la noche en Argentina ya es 1° de enero en
  // UTC, así que un gasto de este año se leía como "del año pasado" y
  // buscaba INDEC_ANNUAL_INFLATION_PCT[año+1], que no existe. Bug real,
  // confirmado forzando TZ=UTC localmente.
  const expenseYear = Number(expenseDateIso.slice(0, 4))
  const currentYear = eventYear(referenceDate.toISOString())
  if (!Number.isFinite(expenseYear) || expenseYear >= currentYear) return null

  let multiplier = 1
  for (let year = expenseYear + 1; year <= currentYear; year++) {
    const pct = INDEC_ANNUAL_INFLATION_PCT[year]
    if (pct === undefined) return null
    multiplier *= 1 + pct / 100
  }

  return {
    adjustedAmount: amountArs * multiplier,
    multiplier,
    fromYear: expenseYear,
    toYear: currentYear,
  }
}
