import { FutureEvent } from '@/src/core/types'
import { ExternalSearchRequest, ExternalSearchResponse, ExternalSourceAdapter } from '../types'
import { fetchWithRetry } from '@/src/core/lib/http'

export const enigmaAdapter: ExternalSourceAdapter = {
  id: 'enigma',
  name: 'Enigma Tickets',
  type: 'scrape',
  isConfigured: () => true,
  search: async (query: ExternalSearchRequest): Promise<ExternalSearchResponse> => {
    try {
      const res = await fetchWithRetry('https://enigmatickets.com/', {
        method: 'GET'
      })

      if (!res.ok) {
        return { events: [], total: 0, error: `Enigma responded with status: ${res.status}` }
      }

      const html = await res.text()
      const events = parseEnigmaHTML(html, query)

      return {
        events,
        total: events.length
      }
    } catch (error) {
      console.error('Enigma adapter error:', error)
      return { events: [], total: 0, error: 'Failed to scrape Enigma' }
    }
  }
}

export function parseEnigmaHTML(html: string, query: ExternalSearchRequest): FutureEvent[] {
  const match = html.match(/window\.__remixContext = ([\s\S]*?);<\/script>/)
  if (!match) return []

  let data
  try {
    data = JSON.parse(match[1])
  } catch {
    return []
  }

  const routes = data?.state?.loaderData || {}
  const indexRoute = routes['routes/_index'] || {}
  const rawEvents = indexRoute.nextEvents || []

  const events: FutureEvent[] = []

  for (const ev of rawEvents) {
    if (!ev.title) continue

    if (query.keyword && !ev.title.toLowerCase().includes(query.keyword.toLowerCase())) {
      continue
    }

    // Usually Unix timestamp array
    let dateStr = ''
    if (ev.eventDates && ev.eventDates.length > 0) {
      dateStr = new Date(ev.eventDates[0] * 1000).toISOString()
    }

    events.push({
      id: `enigma-${ev.uid || Math.random().toString(36).substring(7)}`,
      title: ev.title,
      datetime: dateStr,
      venue: {
        name: ev.venue?.name || ev.placeDescription || 'Enigma',
        city: query.city || null
      },
      lineup: [],
      url: `https://enigmatickets.com/`, // Fallback
      image: ev.imageUrl || ev.imageUrlSmall
    })
  }

  return events
}
