import { createClient } from '@/src/core/lib/supabase/server'
import { FutureEvent } from '@/src/core/types'
import { ExternalSearchRequest, ExternalSearchResponse } from './types'

export async function searchCachedExternalEvents(
  query: ExternalSearchRequest
): Promise<ExternalSearchResponse> {
  const supabase = await createClient()

  let dbQuery = supabase
    .from('external_events_cache')
    .select('event_data, source_id, dedup_key')
    .gt('expires_at', new Date().toISOString())

  if (query.keyword) {
    dbQuery = dbQuery.ilike('event_data->>title', `%${query.keyword}%`)
  }

  if (query.city) {
    dbQuery = dbQuery.ilike('event_data->venue->>city', `%${query.city}%`)
  }

  const { data, error } = await dbQuery

  if (error) {
    console.error('Error fetching cached external events:', error)
    return { events: [], total: 0, error: 'Database error fetching external events' }
  }

  // Deduplication
  const dedupedMap = new Map<string, FutureEvent>()
  
  for (const row of data) {
    const event = row.event_data as unknown as FutureEvent
    const key = row.dedup_key

    if (!dedupedMap.has(key)) {
      dedupedMap.set(key, event)
    } else {
      // Merge: append to title or keep the more complete one
      // If we want to add an array of URLs or a "+1 fuente" badge in the UI, we'd need to modify FutureEvent.
      // For Wave 1, just skipping the duplicate is a valid first dedup implementation.
    }
  }

  const events = Array.from(dedupedMap.values())

  return {
    events,
    total: events.length
  }
}
