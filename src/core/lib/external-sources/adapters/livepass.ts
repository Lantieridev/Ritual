import crypto from 'crypto'
import * as cheerio from 'cheerio'
import { FutureEvent } from '@/src/core/types'
import { ExternalSearchRequest, ExternalSearchResponse, ExternalSourceAdapter } from '../types'
import { fetchWithRetry } from '@/src/core/lib/http'

export const livepassAdapter: ExternalSourceAdapter = {
  id: 'livepass',
  name: 'Livepass',
  type: 'scrape',
  isConfigured: () => true,
  search: async (query: ExternalSearchRequest): Promise<ExternalSearchResponse> => {
    try {
      const res = await fetchWithRetry('https://livepass.com.ar/', {
        method: 'GET'
      })

      if (!res.ok) {
        return { events: [], total: 0, error: `Livepass responded with status: ${res.status}` }
      }

      const html = await res.text()
      const events = parseLivepassHTML(html, query)

      return {
        events,
        total: events.length
      }
    } catch (error) {
      console.error('Livepass adapter error:', error)
      return { events: [], total: 0, error: 'Failed to scrape Livepass' }
    }
  }
}

export function parseLivepassHTML(html: string, query: ExternalSearchRequest): FutureEvent[] {
  const $ = cheerio.load(html)
  const events: FutureEvent[] = []
  const seenUrls = new Set<string>()

  $('div.item, div.card, div.event, .owl-item').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    if (text.length > 5 && !text.includes('Opera La Plata')) {
      let title = $(el).find('img').attr('data-event-name') || ''
      if (!title) {
        title = $(el).find('h1, h4, p.title, .name').text().trim() || $(el).find('p').first().text().trim()
      }

      const img = $(el).find('img').attr('src')
      let href = $(el).find('a').attr('href') || $(el).attr('href')

      if (href && href.includes('/events/') && title) {
        if (!href.startsWith('http')) {
          href = 'https://livepass.com.ar' + href
        }

        if (seenUrls.has(href)) return
        seenUrls.add(href)

        if (query.keyword && !title.toLowerCase().includes(query.keyword.toLowerCase())) {
          return
        }

        events.push({
          id: `livepass-${crypto.createHash('md5').update(href).digest('hex').substring(0, 8)}`,
          title,
          datetime: text.split(' ').slice(0, 3).join(' '), // Best effort, or leave blank if we can't parse safely
          venue: {
            name: 'Livepass',
            city: query.city || null
          },
          lineup: [],
          url: href,
          image: img
        })
      }
    }
  })

  return events
}
