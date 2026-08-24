import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchCachedExternalEvents } from './cache'
import { createClient } from '@/src/core/lib/supabase/server'
import { FutureEvent } from '@/src/core/types'

vi.mock('@/src/core/lib/supabase/server')

describe('searchCachedExternalEvents', () => {
  const mockEvent1: FutureEvent = {
    id: '1', title: 'Test Event 1', datetime: '2026-10-10T20:00:00', venue: { name: 'Venue 1' }, lineup: []
  }
  const mockEvent2: FutureEvent = {
    id: '2', title: 'Test Event 2', datetime: '2026-11-10T20:00:00', venue: { name: 'Venue 2' }, lineup: []
  }

  const mockDbData = [
    { event_data: mockEvent1, source_id: 'alpogo', dedup_key: 'test-event-1-2026-10-10' },
    { event_data: mockEvent1, source_id: 'venti', dedup_key: 'test-event-1-2026-10-10' }, // Duplicate!
    { event_data: mockEvent2, source_id: 'alpogo', dedup_key: 'test-event-2-2026-11-10' },
  ]

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('deduplicates events based on dedup_key', async () => {
    const mockQuery = {
      ilike: vi.fn().mockReturnThis(),
      then: function(resolve: (value: unknown) => void) { resolve({ data: mockDbData, error: null }) }
    }

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gt: vi.fn().mockReturnValue(mockQuery)
        })
      })
    }
    
    vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as ReturnType<typeof createClient>)

    const result = await searchCachedExternalEvents({})
    
    expect(result.error).toBeUndefined()
    expect(result.events).toHaveLength(2)
    expect(result.total).toBe(2)
    
    const ids = result.events.map(e => e.id).sort()
    expect(ids).toEqual(['1', '2'])
  })
})
