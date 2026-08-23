import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
    createClient: () => mockCreateClient(),
}))

import {
    getShowModePreferences,
    getChecklistTemplateItems,
    getEventChecklistState,
    getShowDateRange,
} from '@/src/domains/showmode/data'
import { DEFAULT_SHOW_MODE_PREFERENCES } from '@/src/domains/showmode/preferences'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
    const builder: Record<string, unknown> = {}
    const chain = () => builder
    builder.select = vi.fn(chain)
    builder.eq = vi.fn(chain)
    builder.order = vi.fn(chain)
    builder.limit = vi.fn(chain)
    builder.maybeSingle = vi.fn(() => Promise.resolve(result))
    builder.single = vi.fn(() => Promise.resolve(result))
    builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(onFulfilled, onRejected)
    return builder
}

/** Devuelve un cliente cuyo `from(tabla)` responde según el mapa dado. */
function clientWithTables(tables: Record<string, { data: unknown; error: unknown }>) {
    const fromMock = vi.fn((table: string) =>
        makeQueryBuilder(tables[table] ?? { data: null, error: null })
    )
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))
    return fromMock
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('getShowModePreferences', () => {
    it('devuelve la ventana guardada por el usuario', async () => {
        clientWithTables({
            user_preferences: {
                data: { show_mode_days_before: 14, show_mode_days_after: 1 },
                error: null,
            },
        })

        expect(await getShowModePreferences('user-1')).toEqual({ daysBefore: 14, daysAfter: 1 })
    })

    it('devuelve los defaults sin tocar el cliente cuando no hay usuario', async () => {
        expect(await getShowModePreferences(null)).toEqual(DEFAULT_SHOW_MODE_PREFERENCES)
        expect(mockCreateClient).not.toHaveBeenCalled()
    })

    it('devuelve los defaults cuando el usuario nunca entró a los ajustes (sin fila todavía)', async () => {
        clientWithTables({ user_preferences: { data: null, error: null } })
        expect(await getShowModePreferences('user-1')).toEqual(DEFAULT_SHOW_MODE_PREFERENCES)
    })

    it('devuelve los defaults ante un error de Supabase, en vez de romper la ficha del evento', async () => {
        clientWithTables({ user_preferences: { data: null, error: { message: 'boom' } } })
        expect(await getShowModePreferences('user-1')).toEqual(DEFAULT_SHOW_MODE_PREFERENCES)
    })

    it('clampea un valor fuera de rango que ya estuviera guardado en la base', async () => {
        clientWithTables({
            user_preferences: {
                data: { show_mode_days_before: 9999, show_mode_days_after: -3 },
                error: null,
            },
        })
        expect(await getShowModePreferences('user-1')).toEqual({ daysBefore: 60, daysAfter: 0 })
    })
})

describe('getChecklistTemplateItems', () => {
    it('lee la plantilla del usuario a través del cliente con sesión', async () => {
        const items = [{ id: 't-1', label: 'Entrada', position: 0 }]
        const fromMock = clientWithTables({ checklist_template_items: { data: items, error: null } })

        expect(await getChecklistTemplateItems('user-1')).toEqual(items)
        expect(fromMock).toHaveBeenCalledWith('checklist_template_items')
    })

    it('devuelve lista vacía sin tocar el cliente cuando no hay usuario', async () => {
        expect(await getChecklistTemplateItems(null)).toEqual([])
        expect(mockCreateClient).not.toHaveBeenCalled()
    })

    it('devuelve lista vacía ante un error, sin lanzar', async () => {
        clientWithTables({ checklist_template_items: { data: null, error: { message: 'boom' } } })
        expect(await getChecklistTemplateItems('user-1')).toEqual([])
    })
})

describe('getEventChecklistState', () => {
    it('trae los ítems ad-hoc y mapea los tildes a la forma del dominio', async () => {
        clientWithTables({
            event_checklist_items: {
                data: [{ id: 'a-1', label: 'SUBE', position: 0, checked: true }],
                error: null,
            },
            event_checklist_checks: {
                data: [{ template_item_id: 't-1', checked: true }],
                error: null,
            },
        })

        const state = await getEventChecklistState('user-1', 'ev-1')

        expect(state.adHocItems).toEqual([{ id: 'a-1', label: 'SUBE', position: 0, checked: true }])
        expect(state.checks).toEqual([{ templateItemId: 't-1', checked: true }])
    })

    it('devuelve el estado vacío sin tocar el cliente cuando no hay usuario', async () => {
        expect(await getEventChecklistState(null, 'ev-1')).toEqual({ adHocItems: [], checks: [] })
        expect(mockCreateClient).not.toHaveBeenCalled()
    })

    it('degrada a vacío si una de las dos lecturas falla, sin lanzar', async () => {
        clientWithTables({
            event_checklist_items: { data: null, error: { message: 'boom' } },
            event_checklist_checks: { data: null, error: null },
        })
        expect(await getEventChecklistState('user-1', 'ev-1')).toEqual({ adHocItems: [], checks: [] })
    })
})

describe('getShowDateRange', () => {
    it('usa la fecha propia del evento cuando no pertenece a ningún festival', async () => {
        clientWithTables({ festival_events: { data: null, error: null } })

        expect(await getShowDateRange({ id: 'ev-1', date: '2026-05-10' })).toEqual({
            startDate: '2026-05-10',
        })
    })

    it(
        'usa el rango completo del festival cuando el evento es un día de uno — así el día 1 ' +
            'no sale de la ventana antes de que el festival termine',
        async () => {
            clientWithTables({
                festival_events: {
                    data: { festivals: { start_date: '2026-05-08', end_date: '2026-05-12' } },
                    error: null,
                },
            })

            expect(await getShowDateRange({ id: 'ev-1', date: '2026-05-08' })).toEqual({
                startDate: '2026-05-08',
                endDate: '2026-05-12',
            })
        }
    )

    it('cae a la fecha del evento si el festival no tiene fecha de inicio cargada', async () => {
        clientWithTables({
            festival_events: { data: { festivals: null }, error: null },
        })

        expect(await getShowDateRange({ id: 'ev-1', date: '2026-05-10' })).toEqual({
            startDate: '2026-05-10',
        })
    })

    it('cae a la fecha del evento ante un error, sin lanzar', async () => {
        clientWithTables({ festival_events: { data: null, error: { message: 'boom' } } })

        expect(await getShowDateRange({ id: 'ev-1', date: '2026-05-10' })).toEqual({
            startDate: '2026-05-10',
        })
    })
})
