import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/showmode/data', () => ({
    getShowModePreferences: vi.fn(),
    getChecklistTemplateItems: vi.fn(),
    getEventChecklistState: vi.fn(),
    getShowDateRange: vi.fn(),
}))

import { getEventShowModeState, getShowModeSettings } from '@/src/domains/showmode/service'
import {
    getShowModePreferences,
    getChecklistTemplateItems,
    getEventChecklistState,
    getShowDateRange,
} from '@/src/domains/showmode/data'
import { DEFAULT_SHOW_MODE_PREFERENCES } from '@/src/domains/showmode/preferences'
import { todayDateOnly } from '@/src/core/lib/dates'

const completeShow = {
    attendanceStatus: 'went' as const,
    expenseCount: 2,
    rating: 5,
    review: 'Tremendo.',
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getShowModePreferences).mockResolvedValue(DEFAULT_SHOW_MODE_PREFERENCES)
    vi.mocked(getChecklistTemplateItems).mockResolvedValue([
        { id: 't-1', label: 'Entrada', position: 0 },
    ])
    vi.mocked(getEventChecklistState).mockResolvedValue({
        adHocItems: [{ id: 'a-1', label: 'SUBE', position: 0, checked: true }],
        checks: [{ templateItemId: 't-1', checked: false }],
    })
    // Un show de hace dos días: dentro de la ventana posterior por default.
    // Se ancla con todayDateOnly (timezone de Argentina) y no con
    // `toISOString().slice(0,10)`, que da el día UTC: entre las 21:00 y la
    // medianoche argentina el día UTC ya es el siguiente, así que "hace dos
    // días" en UTC era "ayer" para la lógica de la app y el test fallaba solo
    // en esa franja horaria.
    const twoDaysAgo = todayDateOnly(new Date(Date.now() - 2 * 86400000))
    vi.mocked(getShowDateRange).mockResolvedValue({ startDate: twoDaysAgo })
})

describe('getEventShowModeState', () => {
    it('combina plantilla, tildes e ítems del show en un solo checklist', async () => {
        const state = await getEventShowModeState(
            { id: 'ev-1', date: '2026-05-10' },
            'user-1',
            completeShow
        )

        expect(state.checklist.map((i) => i.label)).toEqual(['Entrada', 'SUBE'])
        expect(state.checklist[0].checked).toBe(false)
        expect(state.checklist[1].checked).toBe(true)
        expect(state.progress).toMatchObject({ done: 1, total: 2 })
    })

    it('resuelve la ventana contra el rango que devuelve data, no contra la fecha cruda del evento', async () => {
        // El evento dice 2020, pero pertenece a un festival que es hoy.
        // Mismo motivo que en el beforeEach: el "hoy" tiene que ser el día
        // calendario de Argentina, no el UTC.
        const today = todayDateOnly()
        vi.mocked(getShowDateRange).mockResolvedValue({ startDate: today, endDate: today })

        const state = await getEventShowModeState(
            { id: 'ev-1', date: '2020-01-01' },
            'user-1',
            completeShow
        )

        expect(getShowDateRange).toHaveBeenCalledWith({ id: 'ev-1', date: '2020-01-01' })
        expect(state.window.phase).toBe('during')
    })

    it('calcula los pendientes a partir de la asistencia y gastos que le pasa la página', async () => {
        const state = await getEventShowModeState({ id: 'ev-1', date: '2026-05-10' }, 'user-1', {
            attendanceStatus: 'went',
            expenseCount: 0,
            rating: null,
            review: null,
        })

        expect(state.pending.map((p) => p.kind)).toEqual(['expenses', 'rating', 'review'])
        expect(state.memoryCardReady).toBe(false)
    })

    it('marca la tarjeta recuerdo lista cuando no queda nada pendiente', async () => {
        const state = await getEventShowModeState(
            { id: 'ev-1', date: '2026-05-10' },
            'user-1',
            completeShow
        )
        expect(state.memoryCardReady).toBe(true)
    })

    it('expone la etiqueta de la fase para la banda del modo activo', async () => {
        const state = await getEventShowModeState(
            { id: 'ev-1', date: '2026-05-10' },
            'user-1',
            completeShow
        )
        expect(state.window.phase).toBe('after')
        expect(state.phaseLabel).toBe('Fue hace 2 días')
    })

    it('no vuelve a pedir gastos ni asistencia: solo lee lo suyo', async () => {
        await getEventShowModeState({ id: 'ev-1', date: '2026-05-10' }, 'user-1', completeShow)

        expect(getShowModePreferences).toHaveBeenCalledWith('user-1')
        expect(getChecklistTemplateItems).toHaveBeenCalledWith('user-1')
        expect(getEventChecklistState).toHaveBeenCalledWith('user-1', 'ev-1')
    })

    it('funciona sin usuario: data devuelve vacíos y el modo queda sin checklist', async () => {
        vi.mocked(getChecklistTemplateItems).mockResolvedValue([])
        vi.mocked(getEventChecklistState).mockResolvedValue({ adHocItems: [], checks: [] })

        const state = await getEventShowModeState({ id: 'ev-1', date: '2026-05-10' }, null, {
            attendanceStatus: null,
            expenseCount: 0,
            rating: null,
            review: null,
        })

        expect(state.checklist).toEqual([])
        expect(state.progress.total).toBe(0)
        expect(state.pending.map((p) => p.kind)).toEqual(['attendance'])
    })
})

describe('getShowModeSettings', () => {
    it('devuelve la ventana y la plantilla que necesita la página de ajustes', async () => {
        const settings = await getShowModeSettings('user-1')

        expect(settings.preferences).toEqual(DEFAULT_SHOW_MODE_PREFERENCES)
        expect(settings.templateItems).toEqual([{ id: 't-1', label: 'Entrada', position: 0 }])
    })
})
