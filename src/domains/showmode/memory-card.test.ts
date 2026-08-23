import { describe, it, expect } from 'vitest'
import {
    buildMemoryCard,
    memoryCardSerial,
    memoryCardFileName,
} from '@/src/domains/showmode/memory-card'
import type { Expense, EventWithRelations } from '@/src/core/types'
import type { EventWeather } from '@/src/domains/weather/weather-service'

const event: EventWithRelations = {
    id: '4f2a91c7-1111-2222-3333-444455556666',
    name: 'Ritual en el Obelisco',
    date: '2026-05-10T21:00:00-03:00',
    venue_id: 'v-1',
    venues: { name: 'Obelisco', city: 'Buenos Aires', country: 'Argentina', lat: -34.6, lng: -58.4 },
    lineups: [
        { artists: { id: 'a-1', name: 'Los Redondos', genre: 'Rock' } },
        { artists: { id: 'a-2', name: 'Soporte', genre: null } },
    ],
}

const expenses: Expense[] = [
    { id: 'e-1', user_id: 'u-1', amount: 15000, category: 'Entrada', note: null, event_id: event.id, date: '2026-05-10' },
    { id: 'e-2', user_id: 'u-1', amount: 5000, category: 'Comida y bebida', note: null, event_id: event.id, date: '2026-05-10' },
    { id: 'e-3', user_id: 'u-1', amount: 3000, category: 'Comida y bebida', note: null, event_id: event.id, date: '2026-05-10' },
]

const weather: EventWeather = {
    temperatureC: 17.4,
    precipitationMm: 0,
    weatherCode: 0,
    isRain: false,
    description: 'Despejado',
    hourLabel: '21:00',
}

function build(overrides: Partial<Parameters<typeof buildMemoryCard>[0]> = {}) {
    return buildMemoryCard({
        event,
        expenses,
        rating: 5,
        review: 'La mejor noche del año.',
        weather,
        reference: new Date('2026-08-23T12:00:00Z'),
        ...overrides,
    })
}

describe('buildMemoryCard — datos esenciales del show', () => {
    it('usa el nombre del evento como título', () => {
        expect(build().title).toBe('Ritual en el Obelisco')
    })

    it('cae al artista principal cuando el evento no tiene nombre', () => {
        const card = build({ event: { ...event, name: null } })
        expect(card.title).toBe('Los Redondos')
    })

    it('cae a "Recital" cuando no hay ni nombre ni lineup', () => {
        const card = build({ event: { ...event, name: null, lineups: null } })
        expect(card.title).toBe('Recital')
    })

    it('arma la sede con nombre y ciudad', () => {
        expect(build().venueLabel).toBe('Obelisco, Buenos Aires')
    })

    it('no inventa sede cuando el evento no tiene una cargada', () => {
        expect(build({ event: { ...event, venues: null } }).venueLabel).toBe('Sede por confirmar')
    })

    it('lista el lineup completo, headliner primero', () => {
        expect(build().lineup).toEqual(['Los Redondos', 'Soporte'])
    })
})

describe('buildMemoryCard — las comparaciones de gasto (issue #7)', () => {
    it('suma el total gastado en el show', () => {
        expect(build().totalSpent).toBe(23000)
    })

    it('agrupa los gastos por categoría, de mayor a menor', () => {
        expect(build().categories).toEqual([
            { category: 'Entrada', icon: '🎟️', total: 15000 },
            { category: 'Comida y bebida', icon: '🍔', total: 8000 },
        ])
    })

    it('reusa la comparación en choripanes en vez de reimplementarla', () => {
        expect(build().choripanLine).toBe('esto son 4,6 choripanes')
    })

    it('no muestra comparación de choripanes cuando no se cargó ningún gasto', () => {
        const card = build({ expenses: [] })
        expect(card.choripanLine).toBeNull()
        expect(card.totalSpent).toBe(0)
        expect(card.categories).toEqual([])
    })

    it('muestra el ajuste por inflación para un show de un año anterior', () => {
        const card = build({
            event: { ...event, date: '2024-05-10T21:00:00-03:00' },
            reference: new Date('2026-08-23T12:00:00Z'),
        })
        expect(card.inflationLine).toMatch(/^Hoy serían \$/)
    })

    it('omite el ajuste por inflación para un show del año en curso (la granularidad es anual)', () => {
        expect(build().inflationLine).toBeNull()
    })

    it('colapsa la cola de categorías en una sola línea "Otros" para que la tarjeta no crezca sin fin', () => {
        const many: Expense[] = ['Entrada', 'Transporte', 'Alojamiento', 'Comida y bebida', 'Merch', 'Otro'].map(
            (category, i) => ({
                id: `e-${i}`,
                user_id: 'u-1',
                amount: 1000 * (10 - i),
                category,
                note: null,
                event_id: event.id,
                date: '2026-05-10',
            })
        )
        const card = build({ expenses: many })
        expect(card.categories).toHaveLength(5)
        expect(card.categories[4].category).toBe('Otros (2)')
        // 6000 (Merch) + 5000 (Otro)
        expect(card.categories[4].total).toBe(11000)
    })
})

describe('buildMemoryCard — el clima (issue #8)', () => {
    it('trae emoji, temperatura redondeada y descripción', () => {
        expect(build().weather).toEqual({ emoji: '☀️', temperatureC: 17, description: 'Despejado' })
    })

    it('usa el emoji de lluvia cuando llovió, sin importar el código WMO', () => {
        const card = build({ weather: { ...weather, isRain: true, precipitationMm: 2 } })
        expect(card.weather?.emoji).toBe('🌧️')
    })

    it('deja el clima en null cuando no se pudo obtener, sin romper la tarjeta', () => {
        const card = build({ weather: null })
        expect(card.weather).toBeNull()
        expect(card.title).toBe('Ritual en el Obelisco')
    })
})

describe('buildMemoryCard — la memoria del usuario', () => {
    it('conserva el puntaje', () => {
        expect(build().rating).toBe(5)
    })

    it('recorta una reseña larga para que entre en el stub', () => {
        const card = build({ review: 'x'.repeat(300) })
        expect(card.reviewExcerpt).toHaveLength(181)
        expect(card.reviewExcerpt?.endsWith('…')).toBe(true)
    })

    it('deja pasar entera una reseña corta, sin puntos suspensivos', () => {
        expect(build().reviewExcerpt).toBe('La mejor noche del año.')
    })

    it('deja la reseña en null cuando está vacía o son solo espacios', () => {
        expect(build({ review: null }).reviewExcerpt).toBeNull()
        expect(build({ review: '   ' }).reviewExcerpt).toBeNull()
    })
})

describe('memoryCardSerial', () => {
    it('deriva un serial estable del id del evento — la misma tarjeta trae siempre el mismo número', () => {
        expect(memoryCardSerial(event.id)).toBe('RTL-4F2A-91C7')
        expect(memoryCardSerial(event.id)).toBe(memoryCardSerial(event.id))
    })

    it('completa con ceros un id más corto de lo esperado en vez de devolver un serial cortado', () => {
        expect(memoryCardSerial('ab')).toBe('RTL-AB00-0000')
    })
})

describe('memoryCardFileName', () => {
    it('arma un nombre de archivo sin acentos ni espacios', () => {
        const card = build({ event: { ...event, name: 'Café Tacvbo en Córdoba' } })
        expect(memoryCardFileName(card)).toBe('ritual-recuerdo-cafe-tacvbo-en-cordoba.png')
    })

    it('cae a un nombre genérico cuando el título no deja ningún caracter usable', () => {
        const card = build({ event: { ...event, name: '¡¿!?' } })
        expect(memoryCardFileName(card)).toBe('ritual-recuerdo-recital.png')
    })
})
