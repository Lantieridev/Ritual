import * as cheerio from 'cheerio'
import crypto from 'crypto'
import { FutureEvent } from '@/src/core/types'
import { ExternalSearchRequest, ExternalSearchResponse, ExternalSourceAdapter } from '../types'
import { fetchWithRetry } from '@/src/core/lib/http'

export const konexAdapter: ExternalSourceAdapter = {
  id: 'konex',
  name: 'CC Konex',
  type: 'scrape',
  isConfigured: () => true,
  search: async (query: ExternalSearchRequest): Promise<ExternalSearchResponse> => {
    try {
      const res = await fetchWithRetry('https://entradas.cckonex.org/', {
        method: 'GET'
      })

      if (!res.ok) {
        return { events: [], total: 0, error: `Konex responded with status: ${res.status}` }
      }

      const html = await res.text()
      const events = parseKonexHTML(html, query)

      return {
        events,
        total: events.length
      }
    } catch (error) {
      console.error('Konex adapter error:', error)
      return { events: [], total: 0, error: 'Failed to scrape Konex' }
    }
  }
}

export function parseKonexHTML(html: string, query: ExternalSearchRequest): FutureEvent[] {
  const $ = cheerio.load(html)
  const events: FutureEvent[] = []
  const seenUrls = new Set<string>()

  $('a').each((_, el) => {
    let href = $(el).attr('href')
    if (!href || href === '#' || href === '/') return
    
    // Some links are relative like "../event/la-bomba-de-tiempo"
    if (href.startsWith('../')) href = href.substring(2)
    
    if (href.startsWith('/')) href = 'https://entradas.cckonex.org' + href
    else if (!href.startsWith('http')) href = 'https://entradas.cckonex.org/' + href

    if (!href.includes('/event/')) return

    if (seenUrls.has(href)) return

    const title = $(el).find('h2, h3, h4, .title').text().trim() || $(el).text().trim().substring(0, 100)
    
    if (title && title.length > 2) {
      // Avoid parsing random non-event buttons that might have event in URL somehow, but usually they are fine
      const cleanTitle = title.replace(/QUIERO IR/gi, '').replace(/\s+/g, ' ').trim()
      
      if (query.keyword && !cleanTitle.toLowerCase().includes(query.keyword.toLowerCase())) {
        return
      }

      seenUrls.add(href)
      const deterministicId = crypto.createHash('md5').update(href).digest('hex').substring(0, 10)

      events.push({
        id: `konex-${deterministicId}`,
        title: cleanTitle,
        datetime: '', // Date is usually inside the event page
        venue: {
          name: 'Ciudad Cultural Konex',
          city: query.city || 'Buenos Aires'
        },
        lineup: [],
        url: href,
        image: $(el).find('img').attr('src') || ''
      })
    }
  })

  return events
}
