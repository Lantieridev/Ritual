import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

const mockCreateClient = vi.fn()
const mockRevalidatePath = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
    createClient: () => mockCreateClient(),
}))

vi.mock('@/src/core/auth/session', () => ({
    getCurrentUserId: vi.fn(),
}))

vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

import {
    saveShowModePreferences,
    addChecklistTemplateItem,
    removeChecklistTemplateItem,
    addEventChecklistItem,
    removeEventChecklistItem,
    setChecklistItemChecked,
} from '@/src/domains/showmode/actions'
import { getCurrentUserId } from '@/src/core/auth/session'

const VALID_EVENT_ID = '22222222-2222-2222-2222-222222222222'
const VALID_ITEM_ID = '33333333-3333-3333-3333-333333333333'

type Spy = Mock<(...args: unknown[]) => unknown>

interface BuilderSpies {
    insert: Spy
    update: Spy
    upsert: Spy
    delete: Spy
    eq: Spy
}

/**
 * Builder encadenable. `result` es lo que devuelven single()/maybeSingle() y
 * el await directo; `count` es lo que devuelve el head:true del conteo.
 */
function makeQueryBuilder(
    result: { data: unknown; error: unknown },
    count: number,
    spies: BuilderSpies
) {
    const builder: Record<string, unknown> = {}
    const chain = () => builder
    builder.select = vi.fn((_cols?: unknown, opts?: { head?: boolean }) => {
        if (opts?.head) {
            return {
                eq: () => ({
                    eq: () => Promise.resolve({ count, error: null }),
                    then: (f: (v: unknown) => unknown) => Promise.resolve({ count, error: null }).then(f),
                }),
            }
        }
        return builder
    })
    builder.insert = vi.fn((...args: unknown[]) => {
        spies.insert(...args)
        return builder
    })
    builder.update = vi.fn((...args: unknown[]) => {
        spies.update(...args)
        return builder
    })
    builder.upsert = vi.fn((...args: unknown[]) => {
        spies.upsert(...args)
        return builder
    })
    builder.delete = vi.fn((...args: unknown[]) => {
        spies.delete(...args)
        return builder
    })
    builder.eq = vi.fn((...args: unknown[]) => {
        spies.eq(...args)
        return builder
    })
    builder.order = vi.fn(chain)
    builder.limit = vi.fn(chain)
    builder.maybeSingle = vi.fn(() => Promise.resolve(result))
    builder.single = vi.fn(() => Promise.resolve(result))
    builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(onFulfilled, onRejected)
    return builder
}

function setupClient(
    result: { data: unknown; error: unknown } = { data: null, error: null },
    count = 0
) {
    const spies: BuilderSpies = {
        insert: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
        delete: vi.fn(),
        eq: vi.fn(),
    }
    const fromMock = vi.fn(() => makeQueryBuilder(result, count, spies))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))
    return { fromMock, spies }
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
})

describe('saveShowModePreferences', () => {
    it('exige usuario autenticado', async () => {
        vi.mocked(getCurrentUserId).mockResolvedValue(null)
        expect(await saveShowModePreferences({ daysBefore: 7, daysAfter: 2 })).toEqual({
            error: 'Usuario no autenticado',
        })
    })

    it('guarda la ventana contra el id de la sesión, no contra uno que venga del cliente', async () => {
        const { fromMock, spies } = setupClient()

        expect(await saveShowModePreferences({ daysBefore: 10, daysAfter: 1 })).toEqual({})

        expect(fromMock).toHaveBeenCalledWith('user_preferences')
        expect(spies.upsert.mock.calls[0][0]).toMatchObject({
            id: 'user-1',
            show_mode_days_before: 10,
            show_mode_days_after: 1,
        })
    })

    it('clampea valores fuera de rango antes de escribir, en vez de chocar con el CHECK de la tabla', async () => {
        const { spies } = setupClient()

        await saveShowModePreferences({ daysBefore: 9999, daysAfter: -4 })

        expect(spies.upsert.mock.calls[0][0]).toMatchObject({
            show_mode_days_before: 60,
            show_mode_days_after: 0,
        })
    })

    it('devuelve un error saneado si Supabase falla', async () => {
        setupClient({ data: null, error: { message: 'permission denied' } })
        const result = await saveShowModePreferences({ daysBefore: 7, daysAfter: 2 })
        expect(result.error).toBe('No tenés permiso para realizar esta acción.')
    })
})

describe('addChecklistTemplateItem', () => {
    it('exige usuario autenticado', async () => {
        vi.mocked(getCurrentUserId).mockResolvedValue(null)
        expect(await addChecklistTemplateItem('Entrada')).toEqual({ error: 'Usuario no autenticado' })
    })

    it('rechaza un ítem vacío o de puros espacios', async () => {
        expect(await addChecklistTemplateItem('   ')).toEqual({
            error: 'El ítem no puede estar vacío.',
        })
    })

    it('inserta el ítem con el user_id de la sesión y lo ubica al final de la lista', async () => {
        const { fromMock, spies } = setupClient({
            data: { id: VALID_ITEM_ID, label: 'Entrada', position: 3 },
            error: null,
        })

        const result = await addChecklistTemplateItem('  Entrada  ')

        expect(fromMock).toHaveBeenCalledWith('checklist_template_items')
        expect(spies.insert).toHaveBeenCalledWith(
            expect.objectContaining({ user_id: 'user-1', label: 'Entrada' })
        )
        expect(result).toEqual({ id: VALID_ITEM_ID, label: 'Entrada', position: 3 })
    })

    it('frena cuando la plantilla ya llegó al tope de ítems', async () => {
        setupClient({ data: null, error: null }, 50)
        const result = await addChecklistTemplateItem('Uno más')
        expect(result.error).toMatch(/50 ítems/)
    })
})

describe('removeChecklistTemplateItem', () => {
    it('valida que el id sea un UUID antes de tocar la base', async () => {
        expect(await removeChecklistTemplateItem('no-es-uuid')).toEqual({ error: 'Ítem inválido.' })
        expect(mockCreateClient).not.toHaveBeenCalled()
    })

    it('exige usuario autenticado', async () => {
        vi.mocked(getCurrentUserId).mockResolvedValue(null)
        expect(await removeChecklistTemplateItem(VALID_ITEM_ID)).toEqual({
            error: 'Usuario no autenticado',
        })
    })

    it('acota el delete al dueño, además de la política RLS', async () => {
        const { spies } = setupClient({ data: [{ id: VALID_ITEM_ID }], error: null })

        expect(await removeChecklistTemplateItem(VALID_ITEM_ID)).toEqual({})

        expect(spies.delete).toHaveBeenCalled()
        expect(spies.eq).toHaveBeenCalledWith('user_id', 'user-1')
    })

    // Un DELETE que RLS bloquea (id ajeno) no es un error para PostgREST:
    // afecta 0 filas y devuelve error: null. Sin este chequeo se reportaba
    // éxito aunque el ítem siguiera ahí.
    it('reporta un error en vez de un falso éxito cuando el delete afecta 0 filas', async () => {
        setupClient({ data: [], error: null })

        expect(await removeChecklistTemplateItem(VALID_ITEM_ID)).toEqual({
            error: 'No se pudo eliminar el ítem.',
        })
    })
})

describe('addEventChecklistItem', () => {
    it('valida el id del evento', async () => {
        expect(await addEventChecklistItem('no-es-uuid', 'SUBE')).toEqual({
            error: 'Evento inválido.',
        })
    })

    it('rechaza un ítem vacío', async () => {
        expect(await addEventChecklistItem(VALID_EVENT_ID, '  ')).toEqual({
            error: 'El ítem no puede estar vacío.',
        })
    })

    it('inserta el ítem atado al evento y al usuario de la sesión, sin tocar la plantilla', async () => {
        const { fromMock, spies } = setupClient({
            data: { id: VALID_ITEM_ID, label: 'SUBE', position: 0 },
            error: null,
        })

        await addEventChecklistItem(VALID_EVENT_ID, 'SUBE')

        expect(fromMock).toHaveBeenCalledWith('event_checklist_items')
        expect(fromMock).not.toHaveBeenCalledWith('checklist_template_items')
        expect(spies.insert).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: 'user-1',
                event_id: VALID_EVENT_ID,
                label: 'SUBE',
                checked: false,
            })
        )
    })
})

describe('removeEventChecklistItem', () => {
    it('valida los dos ids', async () => {
        expect(await removeEventChecklistItem('no-es-uuid', VALID_ITEM_ID)).toEqual({
            error: 'Evento inválido.',
        })
        expect(await removeEventChecklistItem(VALID_EVENT_ID, 'no-es-uuid')).toEqual({
            error: 'Ítem inválido.',
        })
    })

    it('borra el ítem del show acotando al dueño', async () => {
        const { fromMock, spies } = setupClient({ data: [{ id: VALID_ITEM_ID }], error: null })

        expect(await removeEventChecklistItem(VALID_EVENT_ID, VALID_ITEM_ID)).toEqual({})

        expect(fromMock).toHaveBeenCalledWith('event_checklist_items')
        expect(spies.eq).toHaveBeenCalledWith('user_id', 'user-1')
    })

    it('reporta un error en vez de un falso éxito cuando el delete afecta 0 filas', async () => {
        setupClient({ data: [], error: null })

        expect(await removeEventChecklistItem(VALID_EVENT_ID, VALID_ITEM_ID)).toEqual({
            error: 'No se pudo eliminar el ítem.',
        })
    })
})

describe('setChecklistItemChecked', () => {
    it('valida los ids y el origen antes de escribir', async () => {
        expect(await setChecklistItemChecked('no-es-uuid', VALID_ITEM_ID, 'adhoc', true)).toEqual({
            error: 'Evento inválido.',
        })
        expect(await setChecklistItemChecked(VALID_EVENT_ID, 'no-es-uuid', 'adhoc', true)).toEqual({
            error: 'Ítem inválido.',
        })
        expect(
            await setChecklistItemChecked(
                VALID_EVENT_ID,
                VALID_ITEM_ID,
                'otro' as 'adhoc',
                true
            )
        ).toEqual({ error: 'Origen de ítem inválido.' })
    })

    it('un ítem ad-hoc guarda su tilde en su propia fila', async () => {
        const { fromMock, spies } = setupClient()

        expect(await setChecklistItemChecked(VALID_EVENT_ID, VALID_ITEM_ID, 'adhoc', true)).toEqual({})

        expect(fromMock).toHaveBeenCalledWith('event_checklist_items')
        expect(spies.update).toHaveBeenCalledWith({ checked: true })
    })

    it(
        'un ítem de plantilla guarda su tilde por (usuario, evento, ítem) — la plantilla es ' +
            'compartida por todos los shows y no puede tener un estado tildado global',
        async () => {
            const { fromMock, spies } = setupClient()

            expect(
                await setChecklistItemChecked(VALID_EVENT_ID, VALID_ITEM_ID, 'template', true)
            ).toEqual({})

            expect(fromMock).toHaveBeenCalledWith('event_checklist_checks')
            expect(fromMock).not.toHaveBeenCalledWith('checklist_template_items')
            expect(spies.upsert.mock.calls[0][0]).toMatchObject({
                user_id: 'user-1',
                event_id: VALID_EVENT_ID,
                template_item_id: VALID_ITEM_ID,
                checked: true,
            })
        }
    )

    it('propaga un error saneado si la escritura falla', async () => {
        setupClient({ data: null, error: { message: 'permission denied' } })
        const result = await setChecklistItemChecked(VALID_EVENT_ID, VALID_ITEM_ID, 'template', true)
        expect(result.error).toBe('No tenés permiso para realizar esta acción.')
    })
})
