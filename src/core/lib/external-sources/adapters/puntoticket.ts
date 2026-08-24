import * as cheerio from 'cheerio'
import crypto from 'crypto'
import { FutureEvent } from '@/src/core/types'
import { ExternalSearchRequest, ExternalSearchResponse, ExternalSourceAdapter } from '../types'
import { fetchWithRetry } from '@/src/core/lib/http'

export const puntoticketAdapter: ExternalSourceAdapter = {
  id: 'puntoticket',
  name: 'PuntoTicket',
  type: 'scrape',
  isConfigured: () => true,
  search: async (query: ExternalSearchRequest): Promise<ExternalSearchResponse> => {
    try {
      const res = await fetchWithRetry('https://www.puntoticket.com/', {
        method: 'GET'
      })

      if (!res.ok) {
        return { events: [], total: 0, error: `PuntoTicket responded with status: ${res.status}` }
      }

      const html = await res.text()
      const events = parsePuntoTicketHTML(html, query)

      return {
        events,
        total: events.length
      }
    } catch (error) {
      console.error('PuntoTicket adapter error:', error)
      return { events: [], total: 0, error: 'Failed to scrape PuntoTicket' }
    }
  }
}

export function parsePuntoTicketHTML(html: string, query: ExternalSearchRequest): FutureEvent[] {
  const $ = cheerio.load(html)
  const events: FutureEvent[] = []
  const seenUrls = new Set<string>()

  $('a').each((_, el) => {
    let href = $(el).attr('href')
    if (!href || !href.includes('/evento/')) return
    
    if (href.startsWith('/')) href = 'https://www.puntoticket.com' + href

    if (seenUrls.has(href)) return

    const title = $(el).find('h2, h3, .title, [class*="title"]').text().trim() || $(el).text().trim().substring(0, 100)
    const dateStr = $(el).find('.date, [class*="date"], [class*="fecha"]').text().trim() || ''
    const img = $(el).find('img').attr('src') || ''

    if (title && title.length > 2) {
      if (query.keyword && !title.toLowerCase().includes(query.keyword.toLowerCase())) {
        return
      }

      seenUrls.add(href)
      const deterministicId = crypto.createHash('md5').update(href).digest('hex').substring(0, 10)

      events.push({
        id: `puntoticket-${deterministicId}`,
        title: title.replace(/\s+/g, ' ').trim(),
        datetime: dateStr,
        venue: {
          name: 'PuntoTicket', // Often venue is in the image or deeper in the page
          city: query.city || null
        },
        lineup: [],
        url: href,
        image: img
      })
    }
  })

  return events
}
