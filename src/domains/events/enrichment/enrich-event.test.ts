import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/core/lib/ticketmaster', () => ({
  isTicketmasterConfigured: vi.fn(),
  searchTicketmasterEvents: vi.fn(),
}))

import { enrichEventFromExternal } from '@/src/domains/events/enrichment/enrich-event'
import { isTicketmasterConfigured, searchTicketmasterEvents } from '@/src/core/lib/ticketmaster'
import type { FutureEvent } from '@/src/core/types'

type Filter = ['eq' | 'is', string, unknown]
interface Write {
  table: string
  patch: Record<string, unknown>
  filters: Filter[]
}

/** Supabase falso: devuelve `event` en el select, registra cada update con sus guardas y cada rpc. */
function makeSupabase(
  event: unknown,
  opts: { selectError?: unknown; updateError?: unknown } = {}
) {
  const writes: Write[] = []
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = []
  const rpc = vi.fn((fn: string, args: Record<string, unknown>) => {
    rpcCalls.push({ fn, args })
    return Promise.resolve({ error: opts.updateError ?? null })
  })
  const from = vi.fn((table: string) => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: event, error: opts.selectError ?? null }),
      }),
    }),
    update: (patch: Record<string, unknown>) => {
      const write: Write = { table, patch, filters: [] }
      writes.push(write)
      const chain = {
        eq: (column: string, value: unknown) => {
          write.filters.push(['eq', column, value])
          return chain
        },
        is: (column: string, value: unknown) => {
          write.filters.push(['is', column, value])
          return chain
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ error: opts.updateError ?? null }).then(resolve),
      }
      return chain
    },
  }))
  return { client: { from, rpc } as never, writes, rpcCalls }
}

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    name: 'Bandalos en Niceto',
    date: '2026-10-10T00:00:00-03:00',
    time_known: false,
    poster_url: null,
    venues: { name: 'Niceto Club', city: 'Buenos Aires' },
    lineups: [{ is_headliner: true, artists: { id: 'a1', name: 'Bandalos Chinos', genre: null } }],
    ...overrides,
  }
}

function candidate(overrides: Partial<FutureEvent> = {}): FutureEvent {
  return {
    id: 'tm1',
    title: 'Bandalos Chinos',
    datetime: '2026-10-10T21:30:00-03:00',
    venue: { name: 'Niceto Club', city: 'Buenos Aires' },
    lineup: ['Bandalos Chinos'],
    image: 'https://img.test/poster.jpg',
    genre: 'Rock',
    ...overrides,
  }
}

describe('enrichEventFromExternal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(isTicketmasterConfigured).mockReturnValue(true)
    vi.mocked(searchTicketmasterEvents).mockResolvedValue({ events: [candidate()], total: 1 })
  })

  it('searches by the headliner and the venue city', async () => {
    const { client } = makeSupabase(eventRow())

    await enrichEventFromExternal(client, 'e1')

    expect(searchTicketmasterEvents).toHaveBeenCalledWith({ keyword: 'Bandalos Chinos', city: 'Buenos Aires' })
  })

  it('falls back to the show name when the lineup is empty', async () => {
    const { client } = makeSupabase(eventRow({ lineups: [] }))

    await enrichEventFromExternal(client, 'e1')

    expect(searchTicketmasterEvents).toHaveBeenCalledWith({ keyword: 'Bandalos en Niceto', city: 'Buenos Aires' })
  })

  it('completes the hour, poster and genre on a confident match, each write guarded', async () => {
    const { client, writes, rpcCalls } = makeSupabase(eventRow())

    await enrichEventFromExternal(client, 'e1')

    expect(writes).toEqual([
      {
        table: 'events',
        patch: { date: '2026-10-10T21:30:00-03:00', time_known: true },
        filters: [['eq', 'id', 'e1'], ['eq', 'time_known', false]],
      },
      {
        table: 'events',
        patch: { poster_url: 'https://img.test/poster.jpg' },
        filters: [['eq', 'id', 'e1'], ['is', 'poster_url', null]],
      },
    ])
    expect(rpcCalls).toEqual([
      { fn: 'fill_artist_genre', args: { p_artist_id: 'a1', p_genre: 'Rock' } },
    ])
  })

  it('does not touch the hour when the user already set it', async () => {
    const { client, writes } = makeSupabase(eventRow({ time_known: true }))

    await enrichEventFromExternal(client, 'e1')

    expect(writes.some((w) => 'date' in w.patch)).toBe(false)
    expect(writes.some((w) => 'poster_url' in w.patch)).toBe(true)
  })

  it('does not use the local-midnight placeholder Ticketmaster fills when it sends no hour', async () => {
    vi.mocked(searchTicketmasterEvents).mockResolvedValue({
      events: [candidate({ datetime: '2026-10-10T00:00:00-03:00' })],
      total: 1,
    })
    const { client, writes } = makeSupabase(eventRow())

    await enrichEventFromExternal(client, 'e1')

    expect(writes.some((w) => 'date' in w.patch)).toBe(false)
  })

  it('does not overwrite an existing poster or genre', async () => {
    const { client, writes, rpcCalls } = makeSupabase(
      eventRow({
        poster_url: 'https://mine.test/p.jpg',
        lineups: [{ is_headliner: true, artists: { id: 'a1', name: 'Bandalos Chinos', genre: 'Indie' } }],
      })
    )

    await enrichEventFromExternal(client, 'e1')

    expect(writes.some((w) => 'poster_url' in w.patch)).toBe(false)
    expect(rpcCalls).toEqual([])
  })

  it('writes nothing when there is no candidate', async () => {
    vi.mocked(searchTicketmasterEvents).mockResolvedValue({ events: [], total: 0 })
    const { client, writes } = makeSupabase(eventRow())

    await enrichEventFromExternal(client, 'e1')

    expect(writes).toEqual([])
  })

  it('writes nothing when two candidates match (ambiguous)', async () => {
    vi.mocked(searchTicketmasterEvents).mockResolvedValue({
      events: [candidate({ id: 'a' }), candidate({ id: 'b' })],
      total: 2,
    })
    const { client, writes } = makeSupabase(eventRow())

    await enrichEventFromExternal(client, 'e1')

    expect(writes).toEqual([])
  })

  it('does nothing and does not search when Ticketmaster is not configured', async () => {
    vi.mocked(isTicketmasterConfigured).mockReturnValue(false)
    const { client, writes } = makeSupabase(eventRow())

    await enrichEventFromExternal(client, 'e1')

    expect(searchTicketmasterEvents).not.toHaveBeenCalled()
    expect(writes).toEqual([])
  })

  it('writes nothing and does not throw when the search reports an error', async () => {
    vi.mocked(searchTicketmasterEvents).mockResolvedValue({ events: [], total: 0, error: 'Límite alcanzado' })
    const { client, writes } = makeSupabase(eventRow())

    await expect(enrichEventFromExternal(client, 'e1')).resolves.toBeUndefined()
    expect(writes).toEqual([])
  })

  it('does not throw when the search itself throws', async () => {
    vi.mocked(searchTicketmasterEvents).mockRejectedValue(new Error('network down'))
    const { client } = makeSupabase(eventRow())

    await expect(enrichEventFromExternal(client, 'e1')).resolves.toBeUndefined()
  })

  it('does not throw and does not search when the event cannot be read', async () => {
    const { client } = makeSupabase(null, { selectError: { message: 'boom' } })

    await expect(enrichEventFromExternal(client, 'e1')).resolves.toBeUndefined()
    expect(searchTicketmasterEvents).not.toHaveBeenCalled()
  })

  it('keeps going and does not throw when one write fails', async () => {
    const { client, writes, rpcCalls } = makeSupabase(eventRow(), { updateError: { message: 'rls' } })

    await expect(enrichEventFromExternal(client, 'e1')).resolves.toBeUndefined()
    expect(writes).toHaveLength(2)
    expect(rpcCalls).toHaveLength(1)
  })
})
