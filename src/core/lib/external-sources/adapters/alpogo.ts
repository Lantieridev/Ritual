import { FutureEvent } from '@/src/core/types'
import { ExternalSearchRequest, ExternalSearchResponse, ExternalSourceAdapter } from '../types'
import { fetchWithRetry } from '@/src/core/lib/http'

export const alpogoAdapter: ExternalSourceAdapter = {
  id: 'alpogo',
  name: 'Alpogo',
  type: 'api',
  isConfigured: () => true, // No API key required for public endpoint
  search: async (query: ExternalSearchRequest): Promise<ExternalSearchResponse> => {
    try {
      // Best effort guess based on 01-research.md. Real API requires POST or specific params.
      const url = new URL('https://alpogo.com/api/events/getEvents2')
      if (query.keyword) {
        url.searchParams.set('search', query.keyword)
      }

      const res = await fetchWithRetry(url.toString(), {
        method: 'POST',
        // Next.js cache bypass for external background fetching, though cron will handle it
      })

      if (!res.ok) {
         return { events: [], total: 0, error: `Alpogo responded with status: ${res.status}` }
      }

      const data = await res.json()
      
      if (!Array.isArray(data)) {
        return { events: [], total: 0, error: 'Alpogo API structure changed or method unrecognized' }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: FutureEvent[] = data.map((ev: any) => ({
        id: `alpogo-${ev.id || Math.random()}`,
        title: ev.name || ev.title || 'Unknown Event',
        datetime: ev.date || ev.datetime || '',
        venue: {
          name: ev.venue || 'Unknown Venue',
          city: ev.city || query.city || null,
        },
        lineup: [],
        url: ev.url || ev.link || `https://alpogo.com/evento/${ev.id}`,
        image: ev.image || ev.image_url,
      }))

      // If there's a city filter, apply it if API didn't
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
      console.error('Alpogo adapter error:', error)
      return { events: [], total: 0, error: 'Failed to fetch from Alpogo API' }
    }
  }
}
