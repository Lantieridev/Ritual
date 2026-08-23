import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./data', () => ({
  getExpenses: vi.fn(),
  getExpenseById: vi.fn(),
  getExpensesForEvent: vi.fn(),
  getExpensesSummary: vi.fn(),
  getVenueArtistSpendEstimate: vi.fn(),
}))

vi.mock('@/src/domains/events/data', () => ({
  getEvents: vi.fn(),
}))

import { getExpenses, getExpenseById, getExpensesForEvent, getExpensesSummary, getVenueArtistSpendEstimate } from './data'
import { getEvents } from '@/src/domains/events/data'
import {
  listExpenses,
  findExpenseById,
  listExpensesForEvent,
  summarizeExpenses,
  listEventOptionsForExpensePicker,
  estimateSpendForEvent,
} from './service'
import type { EventWithRelations } from '@/src/core/types'

/**
 * This service is the seam introduced for issue #25: Server Components and
 * the GraphQL resolver call these functions instead of importing ./data (or,
 * for the picker, the events domain's data.ts) directly. These tests only
 * need to prove each use case delegates to the right data-layer call with
 * the right arguments — the actual Supabase behavior is already covered by
 * data.test.ts.
 */
describe('expenses service (use-case layer)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listExpenses delegates to getExpenses with the given userId', async () => {
    vi.mocked(getExpenses).mockResolvedValue([{ id: 'e1', user_id: 'u1', amount: 100, category: 'Otro', date: '2026-01-01' }])

    const result = await listExpenses('u1')

    expect(getExpenses).toHaveBeenCalledWith('u1')
    expect(result).toEqual([{ id: 'e1', user_id: 'u1', amount: 100, category: 'Otro', date: '2026-01-01' }])
  })

  it('findExpenseById delegates to getExpenseById with id and userId', async () => {
    vi.mocked(getExpenseById).mockResolvedValue(null)

    const result = await findExpenseById('e1', 'u1')

    expect(getExpenseById).toHaveBeenCalledWith('e1', 'u1')
    expect(result).toBeNull()
  })

  it('listExpensesForEvent delegates to getExpensesForEvent with eventId and userId', async () => {
    vi.mocked(getExpensesForEvent).mockResolvedValue([])

    const result = await listExpensesForEvent('ev1', 'u1')

    expect(getExpensesForEvent).toHaveBeenCalledWith('ev1', 'u1')
    expect(result).toEqual([])
  })

  it('summarizeExpenses delegates to getExpensesSummary with the given userId', async () => {
    const summary = { total: 100, byCategory: {}, byYear: {}, count: 1 }
    vi.mocked(getExpensesSummary).mockResolvedValue(summary)

    const result = await summarizeExpenses('u1')

    expect(getExpensesSummary).toHaveBeenCalledWith('u1')
    expect(result).toBe(summary)
  })

  it('listEventOptionsForExpensePicker delegates to the events domain getEvents, with no arguments', async () => {
    vi.mocked(getEvents).mockResolvedValue([])

    const result = await listEventOptionsForExpensePicker()

    expect(getEvents).toHaveBeenCalledWith()
    expect(result).toEqual([])
  })

  it('estimateSpendForEvent extracts venue_id and lineup artist ids from the event before delegating', async () => {
    const estimate = { averageTotal: 6000, eventsConsidered: 2 }
    vi.mocked(getVenueArtistSpendEstimate).mockResolvedValue(estimate)
    const event = {
      id: 'ev-1',
      venue_id: 'venue-1',
      lineups: [
        { artists: { id: 'artist-1', name: 'Band A' } },
        { artists: { id: 'artist-2', name: 'Band B' } },
      ],
    } as unknown as EventWithRelations

    const result = await estimateSpendForEvent(event, 'u1')

    expect(getVenueArtistSpendEstimate).toHaveBeenCalledWith('u1', 'venue-1', ['artist-1', 'artist-2'], 'ev-1')
    expect(result).toBe(estimate)
  })

  it('estimateSpendForEvent passes an empty artist list when the event has no lineup', async () => {
    vi.mocked(getVenueArtistSpendEstimate).mockResolvedValue(null)
    const event = { id: 'ev-1', venue_id: null, lineups: null } as unknown as EventWithRelations

    await estimateSpendForEvent(event, 'u1')

    expect(getVenueArtistSpendEstimate).toHaveBeenCalledWith('u1', null, [], 'ev-1')
  })
})
