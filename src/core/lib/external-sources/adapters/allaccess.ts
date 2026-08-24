import { FutureEvent } from '@/src/core/types'
import { ExternalSearchRequest, ExternalSearchResponse, ExternalSourceAdapter } from '../types'
import { fetchWithRetry } from '@/src/core/lib/http'

export const allaccessAdapter: ExternalSourceAdapter = {
  id: 'allaccess',
  name: 'All Access',
  type: 'scrape',
  isConfigured: () => true,
  search: async (query: ExternalSearchRequest): Promise<ExternalSearchResponse> => {
    try {
      const res = await fetchWithRetry('https://www.allaccess.com.ar/', {
        method: 'GET'
      })

      if (!res.ok) {
        return { events: [], total: 0, error: `AllAccess responded with status: ${res.status}` }
      }

      const html = await res.text()
      const events = parseAllAccessHTML(html, query)

      return {
        events,
        total: events.length
      }
    } catch (error) {
      console.error('AllAccess adapter error:', error)
      return { events: [], total: 0, error: 'Failed to scrape AllAccess' }
    }
  }
}

export function parseAllAccessHTML(html: string, query: ExternalSearchRequest): FutureEvent[] {
  const match = html.match(/var App = window\.App = new \(require\('app\/app'\)\)\(([\s\S]*?)\);\n/)
  if (!match) return []

  let data
  try {
    data = JSON.parse(match[1])
  } catch {
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawCards: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function findCards(obj: any) {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj.cards)) {
      rawCards.push(...obj.cards)
    }
    Object.values(obj).forEach(v => findCards(v))
  }
  findCards(data)

  const events: FutureEvent[] = []
  const seenUrls = new Set<string>()

  for (const card of rawCards) {
    if (!card.title) continue

    const title = String(card.title).trim()
    let url = String(card.link || '')
    if (url.startsWith('../')) {
      url = 'https://www.allaccess.com.ar/' + url.substring(3)
    } else if (url.startsWith('/')) {
      url = 'https://www.allaccess.com.ar' + url
    }

    if (seenUrls.has(url)) continue
    seenUrls.add(url)

    // filter by keyword
    if (query.keyword && !title.toLowerCase().includes(query.keyword.toLowerCase())) {
      continue
    }

    events.push({
      id: `allaccess-${Math.random().toString(36).substring(7)}`,
      title,
      datetime: card.line1 || card.description || '',
      venue: {
        name: 'All Access', // Their cards often omit venue or put it in title, we fallback
        city: query.city || null
      },
      lineup: [],
      url: url || 'https://www.allaccess.com.ar/',
      image: card.imgUrl
    })
  }

  return events
}
