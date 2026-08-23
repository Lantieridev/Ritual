import { describe, it, expect } from 'vitest'
import { weatherEmoji } from '@/src/domains/weather/icons'

describe('weatherEmoji', () => {
    it('la lluvia gana sobre el código WMO, igual que la regla de weather-service', () => {
        expect(weatherEmoji(0, true)).toBe('🌧️')
    })

    it('mapea los códigos de cielo', () => {
        expect(weatherEmoji(0, false)).toBe('☀️')
        expect(weatherEmoji(1, false)).toBe('🌤️')
        expect(weatherEmoji(2, false)).toBe('🌤️')
        expect(weatherEmoji(3, false)).toBe('☁️')
    })

    it('mapea niebla, nieve y tormenta', () => {
        expect(weatherEmoji(45, false)).toBe('🌫️')
        expect(weatherEmoji(48, false)).toBe('🌫️')
        expect(weatherEmoji(75, false)).toBe('❄️')
        expect(weatherEmoji(95, false)).toBe('⛈️')
    })

    it('cae al termómetro sin código o con uno desconocido, en vez de romper', () => {
        expect(weatherEmoji(null, false)).toBe('🌡️')
        expect(weatherEmoji(64, false)).toBe('🌡️')
    })
})
