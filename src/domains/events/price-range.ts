import type { FutureEvent } from '@/src/core/types'

/**
 * Formats Ticketmaster's priceRange for display in search results (issue
 * #57). Ticketmaster reports it in whatever currency the market uses (ARS,
 * USD, MXN, ...), so this leans on Intl.NumberFormat instead of a hardcoded
 * "$" like the expenses side of the app does — that shortcut only works
 * because expenses are always ARS.
 *
 * Returns null when there's nothing to show, so callers can skip rendering
 * cleanly instead of leaving an empty range like "$0 - $0".
 */
export function formatPriceRange(priceRange: FutureEvent['priceRange']): string | null {
  if (!priceRange) return null
  const { min, max, currency } = priceRange
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0) return null

  let formatter: Intl.NumberFormat
  try {
    formatter = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    })
  } catch {
    // Currency code Ticketmaster no reconocido por Intl -mostrar el número
    // pelado antes que reventar el render de toda la lista de resultados.
    return min === max ? `${min.toLocaleString('es-AR')} ${currency}` : `${min.toLocaleString('es-AR')}–${max.toLocaleString('es-AR')} ${currency}`
  }

  if (min === max) return formatter.format(min)
  return `${formatter.format(min)} – ${formatter.format(max)}`
}
