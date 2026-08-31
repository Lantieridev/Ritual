import crypto from 'crypto'
import { FutureEvent } from '@/src/core/types'
import { ExternalSearchRequest, ExternalSearchResponse, ExternalSourceAdapter } from '../types'
import { fetchWithRetry } from '@/src/core/lib/http'

export const quehacemosAdapter: ExternalSourceAdapter = {
  id: 'quehacemos',
  name: 'Quehacemos',
  type: 'api',
  isConfigured: () => true,
  search: async (query: ExternalSearchRequest): Promise<ExternalSearchResponse> => {
    try {
      const url = new URL('https://api.quehacemos.com.ar/api/v1/events')
      if (query.keyword) {
        url.searchParams.set('search', query.keyword)
      }
      if (query.city) {
        url.searchParams.set('city', query.city)
      }

      const res = await fetchWithRetry(url.toString(), {
        method: 'GET',
      })

      if (!res.ok) {
        return { events: [], total: 0, error: `Quehacemos responded with status: ${res.status}` }
      }

      const data = await res.json()
      
      const rawEvents = Array.isArray(data) ? data : (data.events || data.data || [])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: FutureEvent[] = rawEvents.map((ev: any) => {
        const title = ev.title || 'Unknown Event'
        const link = ev.link || ev.url || ''
        const stableId = ev.id || crypto.createHash('md5').update(`${title}-${link}`).digest('hex').substring(0, 8)
        return {
          id: `quehacemos-${stableId}`,
          title,
          datetime: ev.date || '',
          venue: {
            name: ev.venue || 'Unknown Venue',
            city: ev.city || null,
          },
          lineup: [],
          url: ev.link || ev.url,
          image: ev.image_url || ev.image,
          priceRange: ev.price ? { min: ev.price, max: ev.max_price || ev.price, currency: 'ARS' } : undefined,
        }
      })

      let filteredEvents = events
      // Fallback filtering if API ignores params
      if (query.keyword && !url.searchParams.has('search')) {
        const keywordLower = query.keyword.toLowerCase()
        filteredEvents = events.filter(e => e.title.toLowerCase().includes(keywordLower))
      }
      if (query.city && !url.searchParams.has('city')) {
        const cityLower = query.city.toLowerCase()
        filteredEvents = events.filter(e => e.venue.city?.toLowerCase().includes(cityLower))
      }

      return {
        events: filteredEvents,
        total: filteredEvents.length
      }
    } catch (error) {
      console.error('Quehacemos adapter error:', error)
      return { events: [], total: 0, error: 'Failed to fetch from Quehacemos API' }
    }
  }
}
