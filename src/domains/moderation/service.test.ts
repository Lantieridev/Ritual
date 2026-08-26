import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

import {
  searchMergeTargets,
  approveArtist,
  approveVenue,
  approveEvent,
  mergeArtists,
} from '@/src/domains/moderation/service'

/** Registra la cadena de llamadas para poder afirmar sobre el filtro construido. */
function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const calls: Record<string, unknown[][]> = {}
  const builder: Record<string, unknown> = {}
  const record = (name: string) =>
    vi.fn((...args: unknown[]) => {
      calls[name] = [...(calls[name] ?? []), args]
      return builder
    })

  builder.select = record('select')
  builder.eq = record('eq')
  builder.neq = record('neq')
  builder.ilike = record('ilike')
  builder.order = record('order')
  builder.limit = record('limit')
  builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)

  return { builder, calls }
}

function mockFrom(result: { data: unknown; error: unknown }) {
  const { builder, calls } = makeQueryBuilder(result)
  const from = vi.fn(() => builder)
  mockCreateClient.mockResolvedValue({ from })
  return { from, calls }
}

function mockRpc(result: { error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result)
  mockCreateClient.mockResolvedValue({ rpc })
  return rpc
}

describe('searchMergeTargets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not touch the database for an empty or whitespace-only term', async () => {
    mockFrom({ data: [], error: null })

    await expect(searchMergeTargets('artists', '   ')).resolves.toEqual([])
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('restricts candidates to already verified rows', async () => {
    const { calls } = mockFrom({ data: [], error: null })

    await searchMergeTargets('artists', 'radiohead')

    expect(calls.eq).toContainEqual(['status', 'verified'])
  })

  it('escapes LIKE wildcards so a term like "100%" cannot match the whole catalog', async () => {
    const { calls } = mockFrom({ data: [], error: null })

    await searchMergeTargets('artists', '100%_x')

    expect(calls.ilike).toEqual([['name', '%100\\%\\_x%']])
  })

  it('escapes backslashes before adding its own, so the escape char is not doubled away', async () => {
    const { calls } = mockFrom({ data: [], error: null })

    await searchMergeTargets('artists', 'AC\\DC')

    expect(calls.ilike).toEqual([['name', '%AC\\\\DC%']])
  })

  it('excludes the source entity when an id is given', async () => {
    const { calls } = mockFrom({ data: [], error: null })

    await searchMergeTargets('artists', 'radiohead', 'a-1')

    expect(calls.neq).toEqual([['id', 'a-1']])
  })

  it('omits the exclusion filter when no source id is given', async () => {
    const { calls } = mockFrom({ data: [], error: null })

    await searchMergeTargets('artists', 'radiohead')

    expect(calls.neq).toBeUndefined()
  })

  it('maps an artist row to its genre as the disambiguating detail', async () => {
    mockFrom({ data: [{ id: 'a-1', name: 'Radiohead', genre: 'rock' }], error: null })

    await expect(searchMergeTargets('artists', 'radio')).resolves.toEqual([
      { id: 'a-1', name: 'Radiohead', detail: 'rock' },
    ])
  })

  it('joins city and address for a venue, skipping the missing half', async () => {
    mockFrom({ data: [{ id: 'v-1', name: 'Niceto', city: 'CABA', address: null }], error: null })

    await expect(searchMergeTargets('venues', 'niceto')).resolves.toEqual([
      { id: 'v-1', name: 'Niceto', detail: 'CABA' },
    ])
  })

  it('leaves the detail null when a venue has neither city nor address', async () => {
    mockFrom({ data: [{ id: 'v-1', name: 'Niceto', city: null, address: null }], error: null })

    await expect(searchMergeTargets('venues', 'niceto')).resolves.toEqual([
      { id: 'v-1', name: 'Niceto', detail: null },
    ])
  })

  it('uses the date as the detail for an event', async () => {
    mockFrom({ data: [{ id: 'e-1', name: 'Show', date: '2026-09-01' }], error: null })

    await expect(searchMergeTargets('events', 'show')).resolves.toEqual([
      { id: 'e-1', name: 'Show', detail: '2026-09-01' },
    ])
  })

  it('propagates a query error instead of returning a silently empty list', async () => {
    mockFrom({ data: null, error: new Error('boom') })

    await expect(searchMergeTargets('artists', 'radiohead')).rejects.toThrow('boom')
  })
})

describe('approve*', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    ['artists', approveArtist],
    ['venues', approveVenue],
    ['events', approveEvent],
  ] as const)('routes %s through the approve_entity RPC', async (entityType, approve) => {
    const rpc = mockRpc({ error: null })

    await approve('x-1')

    expect(rpc).toHaveBeenCalledWith('approve_entity', {
      entity_type: entityType,
      entity_id: 'x-1',
    })
  })

  it('propagates the RPC error so an insufficient_privilege never reads as success', async () => {
    mockRpc({ error: new Error('insufficient_privilege') })

    await expect(approveArtist('a-1')).rejects.toThrow('insufficient_privilege')
  })
})

describe('mergeArtists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls the merge_artists RPC with the source and target ids', async () => {
    const rpc = mockRpc({ error: null })

    await mergeArtists('a-source', 'a-target')

    expect(rpc).toHaveBeenCalledWith('merge_artists', {
      source_id: 'a-source',
      target_id: 'a-target',
    })
  })

  it('propagates the RPC error', async () => {
    mockRpc({ error: new Error('insufficient_privilege') })

    await expect(mergeArtists('a-source', 'a-target')).rejects.toThrow('insufficient_privilege')
  })
})
