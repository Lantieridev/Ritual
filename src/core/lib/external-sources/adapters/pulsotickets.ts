import { FutureEvent } from '@/src/core/types'
import { ExternalSearchRequest, ExternalSearchResponse, ExternalSourceAdapter } from '../types'
import { fetchWithRetry } from '@/src/core/lib/http'
import crypto from 'crypto'
import * as cheerio from 'cheerio'

export const pulsoticketsAdapter: ExternalSourceAdapter = {
  id: 'pulsotickets',
  name: 'PulsoTickets',
  type: 'scrape',
  isConfigured: () => true,
  search: async (query: ExternalSearchRequest): Promise<ExternalSearchResponse> => {
    try {
      const res = await fetchWithRetry('https://pulsotickets.com/', {
        method: 'GET'
      })

      if (!res.ok) {
        return { events: [], total: 0, error: `PulsoTickets responded with status: ${res.status}` }
      }

      const html = await res.text()
      const events = parsePulsoTicketsHTML(html, query)

      return {
        events,
        total: events.length
      }
    } catch (error) {
      console.error('PulsoTickets adapter error:', error)
      return { events: [], total: 0, error: 'Failed to scrape PulsoTickets' }
    }
  }
}

export function parsePulsoTicketsHTML(html: string, query: ExternalSearchRequest): FutureEvent[] {
  const $ = cheerio.load(html)
  const events: FutureEvent[] = []
  const seenUrls = new Set<string>()

  // Usually cards are within div.group
  $('div.group').each((_, el) => {
    const linkEl = $(el).find('a[href*="/evento/"]').first()
    const url = linkEl.attr('href') || ''
    
    if (!url || seenUrls.has(url)) return
    seenUrls.add(url)

    const titleEl = $(el).find('h3')
    const title = titleEl.text().trim()
    
    if (!title) return

    if (query.keyword && !title.toLowerCase().includes(query.keyword.toLowerCase())) {
      return
    }

    const dateVenueStr = $(el).find('p.text-slate-500').text().trim()
    const parts = dateVenueStr.split(' - ')
    const datetime = parts[0] ? parts[0].trim() : ''
    const venueName = parts.length > 1 ? parts[1].trim() : 'PulsoTickets'

    const imageEl = $(el).find('img')
    const image = imageEl.attr('src') || ''

    const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 8)

    events.push({
      id: `pulsotickets-${hash}`,
      title,
      datetime,
      venue: {
        name: venueName,
        city: query.city || null
      },
      lineup: [],
      url,
      image
    })
  })

  return events
}
