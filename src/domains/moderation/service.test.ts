import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('./data', () => ({
  getUnverifiedArtists: vi.fn(),
  getUnverifiedVenues: vi.fn(),
  getUnverifiedEvents: vi.fn(),
  searchMergeTargets: vi.fn(),
}))

import {
  listUnverifiedArtists,
  listUnverifiedVenues,
  listUnverifiedEvents,
  searchMergeTargets,
  approveArtist,
  approveVenue,
  approveEvent,
  mergeArtists,
} from '@/src/domains/moderation/service'
import {
  getUnverifiedArtists,
  getUnverifiedVenues,
  getUnverifiedEvents,
  searchMergeTargets as searchMergeTargetsData,
} from '@/src/domains/moderation/data'

function mockRpc(result: { error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result)
  mockCreateClient.mockResolvedValue({ rpc })
  return rpc
}

describe('listUnverified* — delegan a data.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listUnverifiedArtists delegates to getUnverifiedArtists', async () => {
    vi.mocked(getUnverifiedArtists).mockResolvedValue([{ id: 'a-1' } as never])

    await expect(listUnverifiedArtists()).resolves.toEqual([{ id: 'a-1' }])
    expect(getUnverifiedArtists).toHaveBeenCalledWith()
  })

  it('listUnverifiedVenues delegates to getUnverifiedVenues', async () => {
    vi.mocked(getUnverifiedVenues).mockResolvedValue([{ id: 'v-1' } as never])

    await expect(listUnverifiedVenues()).resolves.toEqual([{ id: 'v-1' }])
    expect(getUnverifiedVenues).toHaveBeenCalledWith()
  })

  it('listUnverifiedEvents delegates to getUnverifiedEvents', async () => {
    vi.mocked(getUnverifiedEvents).mockResolvedValue([{ id: 'e-1' } as never])

    await expect(listUnverifiedEvents()).resolves.toEqual([{ id: 'e-1' }])
    expect(getUnverifiedEvents).toHaveBeenCalledWith()
  })

  it('searchMergeTargets delegates to data.ts with the same arguments', async () => {
    vi.mocked(searchMergeTargetsData).mockResolvedValue([{ id: 'a-1', name: 'Radiohead', detail: 'rock' }])

    await expect(searchMergeTargets('artists', 'radio', 'a-2')).resolves.toEqual([
      { id: 'a-1', name: 'Radiohead', detail: 'rock' },
    ])
    expect(searchMergeTargetsData).toHaveBeenCalledWith('artists', 'radio', 'a-2')
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
