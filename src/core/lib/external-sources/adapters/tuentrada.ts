import * as cheerio from 'cheerio'
import crypto from 'crypto'
import { FutureEvent } from '@/src/core/types'
import { ExternalSearchRequest, ExternalSearchResponse, ExternalSourceAdapter } from '../types'
import { fetchWithRetry } from '@/src/core/lib/http'

export const tuentradaAdapter: ExternalSourceAdapter = {
  id: 'tuentrada',
  name: 'TuEntrada',
  type: 'scrape',
  isConfigured: () => true,
  search: async (query: ExternalSearchRequest): Promise<ExternalSearchResponse> => {
    try {
      const res = await fetchWithRetry('https://tuentrada.com/', {
        method: 'GET'
      })

      if (!res.ok) {
        return { events: [], total: 0, error: `TuEntrada responded with status: ${res.status}` }
      }

      const html = await res.text()
      const events = parseTuentradaHTML(html, query)

      return {
        events,
        total: events.length
      }
    } catch (error) {
      console.error('TuEntrada adapter error:', error)
      return { events: [], total: 0, error: 'Failed to scrape TuEntrada' }
    }
  }
}

export function parseTuentradaHTML(html: string, query: ExternalSearchRequest): FutureEvent[] {
  const $ = cheerio.load(html)
  const events: FutureEvent[] = []
  const seenUrls = new Set<string>()

  $('a').each((_, el) => {
    let href = $(el).attr('href')
    if (!href) return

    if (href.startsWith('/')) href = 'https://tuentrada.com' + href
    else if (!href.startsWith('http')) href = 'https://tuentrada.com/' + href

    if (seenUrls.has(href)) return

    const title = $(el).find('h2').text().trim() || $(el).text().trim()
    const img = $(el).find('img').attr('src') || $(el).find('img').attr('srcset') || ''

    if (title && img && title.length > 3 && !href.includes('account.oneboxtds') && !href.includes('ayuda')) {
      const parentDiv = $(el).closest('div').parent()
      const spans = parentDiv.find('span').map((i, s) => $(s).text().trim()).get()
      
      let venueName = 'TuEntrada'
      let dateStr = ''
      if (spans.length >= 1) venueName = spans[0]
      if (spans.length >= 2) dateStr = spans.slice(1).join(' ')
      
      if (query.keyword && !title.toLowerCase().includes(query.keyword.toLowerCase())) {
        return
      }

      seenUrls.add(href)
      const deterministicId = crypto.createHash('md5').update(href).digest('hex').substring(0, 10)

      events.push({
        id: `tuentrada-${deterministicId}`,
        title,
        datetime: dateStr, // Scraped dates are usually in Spanish plain text
        venue: {
          name: venueName,
          city: query.city || null
        },
        lineup: [],
        url: href,
        image: img.split(' ')[0] // In case of srcset
      })
    }
  })

  return events
}
