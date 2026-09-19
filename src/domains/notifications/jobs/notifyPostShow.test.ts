import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CronSupabaseClient } from '@/src/core/lib/cron'

const notify = vi.fn()
vi.mock('../notify', () => ({ notify: (...args: unknown[]) => notify(...args) }))

import { argentinaYesterday, notifyPostShow } from './notifyPostShow'

function query(result: { data: unknown; error: unknown }) {
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'gte', 'lt', 'in']) chain[m] = () => chain
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
    return chain
}

function makeSupabase(tables: Record<string, { data: unknown; error: unknown }>) {
    return { from: (t: string) => query(tables[t]) } as unknown as CronSupabaseClient
}

describe('argentinaYesterday', () => {
    it('is the previous Argentine calendar day, expressed in UTC', () => {
        // 2026-09-19 16:00 UTC is 2026-09-19 13:00 in Buenos Aires -> yesterday is the 18th.
        expect(argentinaYesterday(new Date('2026-09-19T16:00:00Z'))).toEqual({
            date: '2026-09-18',
            startIso: '2026-09-18T03:00:00.000Z',
            endIso: '2026-09-19T03:00:00.000Z',
        })
    })

    it('uses the Argentine date, not the UTC one, near midnight', () => {
        // 2026-09-19 02:00 UTC is still 2026-09-18 23:00 in Buenos Aires -> yesterday is the 17th.
        expect(argentinaYesterday(new Date('2026-09-19T02:00:00Z')).date).toBe('2026-09-17')
    })
})

describe('notifyPostShow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, 'error').mockImplementation(() => {})
        notify.mockResolvedValue({ outcome: 'created', id: 'n1' })
    })

    const now = new Date('2026-09-19T16:00:00Z')

    it('sends one reminder listing everything pending for a show the user attended', async () => {
        const supabase = makeSupabase({
            events: { data: [{ id: 'e1', name: 'Divididos' }], error: null },
            attendance: { data: [{ user_id: 'u1', event_id: 'e1', status: 'went', rating: null, review: null }], error: null },
            expenses: { data: [], error: null },
        })

        const result = await notifyPostShow(supabase, { now })

        expect(notify).toHaveBeenCalledTimes(1)
        expect(notify).toHaveBeenCalledWith(
            supabase,
            expect.objectContaining({
                userId: 'u1',
                type: 'post_show_reminder',
                title: 'Te faltan datos de Divididos',
                body: 'Cargar los gastos de esa noche\nPuntuar el show\nEscribir la reseña',
                dedupeKey: 'post_show:e1',
                payload: { eventId: 'e1', pending: ['expenses', 'rating', 'review'] },
            })
        )
        expect(result).toEqual({
            ok: true,
            details: { events: 1, candidates: 1, created: 1, duplicates: 0, suppressed: 0, failed: 0, complete: 0 },
        })
    })

    it('asks only to confirm attendance when the user was marked as going', async () => {
        const supabase = makeSupabase({
            events: { data: [{ id: 'e1', name: 'Show' }], error: null },
            attendance: { data: [{ user_id: 'u1', event_id: 'e1', status: 'going', rating: null, review: null }], error: null },
            expenses: { data: [], error: null },
        })

        await notifyPostShow(supabase, { now })

        expect(notify).toHaveBeenCalledWith(supabase, expect.objectContaining({ body: 'Confirmar si fuiste' }))
    })

    it('does not notify when nothing is pending', async () => {
        const supabase = makeSupabase({
            events: { data: [{ id: 'e1', name: 'Show' }], error: null },
            attendance: { data: [{ user_id: 'u1', event_id: 'e1', status: 'went', rating: 5, review: 'Genial' }], error: null },
            expenses: { data: [{ user_id: 'u1', event_id: 'e1' }], error: null },
        })

        const result = await notifyPostShow(supabase, { now })

        expect(notify).not.toHaveBeenCalled()
        expect(result.details.complete).toBe(1)
    })

    it('counts duplicates, suppressed and failed outcomes separately', async () => {
        notify
            .mockResolvedValueOnce({ outcome: 'duplicate' })
            .mockResolvedValueOnce({ outcome: 'suppressed' })
            .mockResolvedValueOnce({ outcome: 'failed' })
        const supabase = makeSupabase({
            events: { data: [{ id: 'e1', name: 'Show' }], error: null },
            attendance: {
                data: ['u1', 'u2', 'u3'].map((u) => ({ user_id: u, event_id: 'e1', status: 'went', rating: null, review: null })),
                error: null,
            },
            expenses: { data: [], error: null },
        })

        const result = await notifyPostShow(supabase, { now })

        expect(result.details).toMatchObject({ duplicates: 1, suppressed: 1, failed: 1, created: 0 })
    })

    it('does nothing when no show happened yesterday', async () => {
        const supabase = makeSupabase({ events: { data: [], error: null } })

        const result = await notifyPostShow(supabase, { now })

        expect(result).toEqual({
            ok: true,
            details: { events: 0, candidates: 0, created: 0, duplicates: 0, suppressed: 0, failed: 0, complete: 0 },
        })
    })

    it('reports not-ok when the events read fails', async () => {
        const supabase = makeSupabase({ events: { data: null, error: { message: 'db down' } } })

        expect((await notifyPostShow(supabase, { now })).ok).toBe(false)
    })

    it('stops once the run budget is spent', async () => {
        const supabase = makeSupabase({
            events: { data: [{ id: 'e1', name: 'Show' }], error: null },
            attendance: {
                data: ['u1', 'u2'].map((u) => ({ user_id: u, event_id: 'e1', status: 'went', rating: null, review: null })),
                error: null,
            },
            expenses: { data: [], error: null },
        })
        const clock = vi.fn().mockReturnValueOnce(0).mockReturnValue(1_000)

        const result = await notifyPostShow(supabase, { now, runStart: new Date(0), budgetMs: 500, clock })

        expect(notify).toHaveBeenCalledTimes(1)
        expect(result.details.stopped_reason).toBe('deadline')
    })
})
