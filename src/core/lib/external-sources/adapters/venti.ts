import { FutureEvent } from '@/src/core/types'
import { ExternalSearchRequest, ExternalSearchResponse, ExternalSourceAdapter } from '../types'
import { fetchWithRetry } from '@/src/core/lib/http'

export const ventiAdapter: ExternalSourceAdapter = {
  id: 'venti',
  name: 'Venti',
  type: 'api',
  isConfigured: () => true,
  search: async (query: ExternalSearchRequest): Promise<ExternalSearchResponse> => {
    try {
      const url = new URL('https://venti.com.ar/api/event/')
      if (query.keyword) {
        url.searchParams.set('q', query.keyword)
      }

      const res = await fetchWithRetry(url.toString(), {
        method: 'GET',
      })

      if (!res.ok) {
        return { events: [], total: 0, error: `Venti responded with status: ${res.status}` }
      }

      const data = await res.json()
      
      const rawEvents = Array.isArray(data) ? data : (data.events || data.data || [])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: FutureEvent[] = rawEvents.map((ev: any) => ({
        id: `venti-${ev.id || Math.random()}`,
        title: ev.name || ev.title || 'Unknown Event',
        datetime: ev.date || ev.datetime || ev.start_date || '',
        venue: {
          name: ev.venue || ev.location?.name || 'Unknown Venue',
          city: ev.city || ev.location?.city || query.city || null,
        },
        lineup: [],
        url: ev.url || ev.link || `https://venti.com.ar/event/${ev.slug || ev.id}`,
        image: ev.image || ev.image_url || ev.cover,
      }))

      let filteredEvents = events
      if (query.city) {
        const cityLower = query.city.toLowerCase()
        filteredEvents = events.filter(e => e.venue.city?.toLowerCase().includes(cityLower))
      }

      return {
        events: filteredEvents,
        total: filteredEvents.length
      }
    } catch (error) {
      console.error('Venti adapter error:', error)
      return { events: [], total: 0, error: 'Failed to fetch from Venti API' }
    }
  }
}
