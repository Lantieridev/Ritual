import { FutureEvent } from '@/src/core/types'
import { ExternalSearchRequest, ExternalSearchResponse, ExternalSourceAdapter } from '../types'
import { fetchWithRetry } from '@/src/core/lib/http'
import crypto from 'crypto'

export const entradawebAdapter: ExternalSourceAdapter = {
  id: 'entradaweb',
  name: 'EntradaWeb',
  type: 'api',
  isConfigured: () => true,
  search: async (query: ExternalSearchRequest): Promise<ExternalSearchResponse> => {
    try {
      const res = await fetchWithRetry('https://bff.entradaweb.com.ar/v1/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })

      if (!res.ok) {
        return { events: [], total: 0, error: `EntradaWeb responded with status: ${res.status}` }
      }

      const data = await res.json()
      const events = parseEntradaWebJSON(data, query)

      return {
        events,
        total: events.length
      }
    } catch (error) {
      console.error('EntradaWeb adapter error:', error)
      return { events: [], total: 0, error: 'Failed to fetch EntradaWeb' }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseEntradaWebJSON(data: any, query: ExternalSearchRequest): FutureEvent[] {
  if (!data || !Array.isArray(data.events)) {
    return []
  }

  const events: FutureEvent[] = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const ev of data.events as any[]) {
    if (!ev.title) continue

    const title = String(ev.title).replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim()

    if (query.keyword && !title.toLowerCase().includes(query.keyword.toLowerCase())) {
      continue
    }

    const url = ev.link || `https://www.entradaweb.com.ar/evento/${ev.eventHash}/step/1`
    
    // Hash URL for deterministic ID
    const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 8)

    events.push({
      id: `entradaweb-${hash}`,
      title,
      datetime: ev.dates || '',
      venue: {
        name: ev.place || 'EntradaWeb',
        city: ev.location || query.city || null
      },
      lineup: [],
      url,
      image: ev.image || ev.mobileImage
    })
  }

  return events
}
