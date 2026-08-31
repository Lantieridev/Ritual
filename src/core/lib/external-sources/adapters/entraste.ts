import crypto from 'crypto'
import * as cheerio from 'cheerio'
import { FutureEvent } from '@/src/core/types'
import { ExternalSearchRequest, ExternalSearchResponse, ExternalSourceAdapter } from '../types'
import { fetchWithRetry } from '@/src/core/lib/http'

export const entrasteAdapter: ExternalSourceAdapter = {
  id: 'entraste',
  name: 'Entraste',
  type: 'scrape',
  isConfigured: () => true,
  search: async (query: ExternalSearchRequest): Promise<ExternalSearchResponse> => {
    try {
      const res = await fetchWithRetry('https://entraste.com/', {
        method: 'GET'
      })

      if (!res.ok) {
        return { events: [], total: 0, error: `Entraste responded with status: ${res.status}` }
      }

      const html = await res.text()
      const events = parseEntrasteHTML(html, query)

      return {
        events,
        total: events.length
      }
    } catch (error) {
      console.error('Entraste adapter error:', error)
      return { events: [], total: 0, error: 'Failed to scrape Entraste' }
    }
  }
}

export function parseEntrasteHTML(html: string, query: ExternalSearchRequest): FutureEvent[] {
  const $ = cheerio.load(html)
  const events: FutureEvent[] = []
  const seenUrls = new Set<string>()

  $('a[href*="/evento/"]').each((_, el) => {
    let href = $(el).attr('href')
    if (!href) return
    
    if (!href.startsWith('http')) {
      href = 'https://entraste.com' + href
    }

    if (seenUrls.has(href)) return
    seenUrls.add(href)

    const title = $(el).find('h3').text().trim() || $(el).find('h2').text().trim() || $(el).find('p').first().text().trim()
    const date = $(el).find('p').eq(1).text().trim() || $(el).text().replace(/\s+/g, ' ').trim()
    const img = $(el).find('img').attr('src')

    if (!title) return

    if (query.keyword && !title.toLowerCase().includes(query.keyword.toLowerCase())) {
      return
    }

    const hash = crypto.createHash('md5').update(href).digest('hex').substring(0, 8)
    events.push({
      id: `entraste-${hash}`,
      title,
      datetime: date,
      venue: {
        name: 'Entraste',
        city: query.city || null
      },
      lineup: [],
      url: href,
      image: img
    })
  })

  return events
}
