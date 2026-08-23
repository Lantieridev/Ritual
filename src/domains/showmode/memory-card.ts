/**
 * Modelo de vista de la "tarjeta recuerdo" (issue #9): el stub de entrada
 * digital que se genera cuando ya está todo cargado de un show.
 *
 * Es el punto donde se componen los dos features que ya existen — los gastos
 * del recital (issue #7, con sus comparaciones propias) y el clima exacto
 * del show (issue #8) — más los datos esenciales del evento y la memoria del
 * usuario. Acá no se re-implementa ninguna de esas reglas: se reusan
 * `groupExpensesByCategory`, `formatChoripanComparison`, `adjustForInflation`
 * y `weatherEmoji` tal cual.
 *
 * Puro y serializable a propósito: lo arma el server component de la ficha
 * del evento y lo recibe como prop el componente de cliente que dibuja y
 * exporta la tarjeta, así que no puede arrastrar dependencias de servidor.
 *
 * NO es una función social — el issue lo aclara explícitamente. Nada acá
 * publica, comparte ni expone la tarjeta: se dibuja para el dueño del show y
 * se descarga como imagen para guardarla fuera de la app.
 */
import { formatDate } from '@/src/core/lib/utils'
import { getExpenseCategory } from '@/src/domains/expenses/categories'
import { groupExpensesByCategory } from '@/src/domains/expenses/grouping'
import { formatChoripanComparison, adjustForInflation } from '@/src/domains/expenses/comparisons'
import { weatherEmoji } from '@/src/domains/weather/icons'
import type { Expense, EventWithRelations } from '@/src/core/types'
import type { EventWeather } from '@/src/domains/weather/weather-service'

/** Cuántas categorías de gasto entran en la tarjeta antes de agruparse en "Otros". */
const MAX_CARD_CATEGORIES = 4

/** Recorte de la reseña que entra en la tarjeta sin romper el layout del stub. */
const REVIEW_EXCERPT_LENGTH = 180

export interface MemoryCardCategoryLine {
    category: string
    icon: string
    total: number
}

export interface MemoryCardWeatherLine {
    emoji: string
    temperatureC: number
    description: string
}

export interface MemoryCardData {
    /** Serial del stub, derivado del id del evento — decorativo, estable entre renders. */
    serial: string
    title: string
    dateLabel: string
    venueLabel: string
    /** Nombres del lineup, headliner primero (el orden en que ya vienen). */
    lineup: string[]
    rating: number | null
    reviewExcerpt: string | null
    totalSpent: number
    categories: MemoryCardCategoryLine[]
    /** "esto son 4,6 choripanes" — null si no hubo gastos. */
    choripanLine: string | null
    /** Poder adquisitivo de hoy para un gasto de otro año; null si no aplica. */
    inflationLine: string | null
    /** null cuando la sede no tiene coordenadas o Open-Meteo no devolvió nada. */
    weather: MemoryCardWeatherLine | null
}

function formatARS(amount: number): string {
    return `$${amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

/**
 * Serial decorativo tipo entrada ("RTL-4F2A-91C7") a partir del uuid del
 * evento. Determinista: la misma tarjeta descargada dos veces trae el mismo
 * número, que es lo que uno espera de un stub.
 */
export function memoryCardSerial(eventId: string): string {
    const hex = eventId.replace(/[^0-9a-f]/gi, '').toUpperCase()
    const first = hex.slice(0, 4).padEnd(4, '0')
    const second = hex.slice(4, 8).padEnd(4, '0')
    return `RTL-${first}-${second}`
}

function truncate(text: string, max: number): string {
    const clean = text.trim()
    if (clean.length <= max) return clean
    return `${clean.slice(0, max).trimEnd()}…`
}

/**
 * Colapsa la cola de categorías chicas en una sola línea "Otros" para que la
 * tarjeta no crezca sin límite cuando alguien cargó ocho tipos de gasto. Con
 * MAX_CARD_CATEGORIES o menos, no toca nada.
 */
function condenseCategories(
    groups: { category: string; total: number }[]
): MemoryCardCategoryLine[] {
    const head = groups.slice(0, MAX_CARD_CATEGORIES).map((g) => ({
        category: g.category,
        icon: getExpenseCategory(g.category).icon,
        total: g.total,
    }))

    const tail = groups.slice(MAX_CARD_CATEGORIES)
    if (tail.length === 0) return head

    return [
        ...head,
        {
            category: `Otros (${tail.length})`,
            icon: '➕',
            total: tail.reduce((sum, g) => sum + g.total, 0),
        },
    ]
}

export interface BuildMemoryCardInput {
    event: EventWithRelations
    expenses: Expense[]
    rating: number | null
    review: string | null
    weather: EventWeather | null
    /** Inyectable para tests — el ajuste por inflación depende del año actual. */
    reference?: Date
}

/** Arma el modelo de vista completo de la tarjeta recuerdo de un show. */
export function buildMemoryCard({
    event,
    expenses,
    rating,
    review,
    weather,
    reference = new Date(),
}: BuildMemoryCardInput): MemoryCardData {
    const mainArtist = event.lineups?.[0]?.artists?.name ?? null
    const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
    const groups = groupExpensesByCategory(expenses)

    const inflation = adjustForInflation(totalSpent, String(event.date), reference)
    const inflationLine = inflation
        ? `Hoy serían ${formatARS(inflation.adjustedAmount)}`
        : null

    return {
        serial: memoryCardSerial(event.id),
        title: event.name || mainArtist || 'Recital',
        dateLabel: formatDate(event.date, { day: 'numeric', month: 'long', year: 'numeric' }),
        venueLabel: event.venues
            ? [event.venues.name, event.venues.city].filter(Boolean).join(', ')
            : 'Sede por confirmar',
        lineup: (event.lineups ?? []).map((row) => row.artists.name),
        rating,
        reviewExcerpt: review?.trim() ? truncate(review, REVIEW_EXCERPT_LENGTH) : null,
        totalSpent,
        categories: condenseCategories(groups),
        choripanLine: formatChoripanComparison(totalSpent),
        inflationLine,
        weather: weather
            ? {
                  emoji: weatherEmoji(weather.weatherCode, weather.isRain),
                  temperatureC: Math.round(weather.temperatureC),
                  description: weather.description,
              }
            : null,
    }
}

/** Nombre de archivo de la descarga, sin acentos ni espacios. */
export function memoryCardFileName(card: MemoryCardData): string {
    const slug = card.title
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    return `ritual-recuerdo-${slug || 'recital'}.png`
}
