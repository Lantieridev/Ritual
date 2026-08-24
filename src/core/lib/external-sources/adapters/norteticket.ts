import { FutureEvent } from '@/src/core/types'
import { ExternalSearchRequest, ExternalSearchResponse, ExternalSourceAdapter } from '../types'
import { fetchWithRetry } from '@/src/core/lib/http'
import crypto from 'crypto'
import * as cheerio from 'cheerio'

export const norteticketAdapter: ExternalSourceAdapter = {
  id: 'norteticket',
  name: 'NorteTicket',
  type: 'scrape',
  isConfigured: () => true,
  search: async (query: ExternalSearchRequest): Promise<ExternalSearchResponse> => {
    try {
      const res = await fetchWithRetry('https://norteticket.com/', {
        method: 'GET'
      })

      if (!res.ok) {
        return { events: [], total: 0, error: `NorteTicket responded with status: ${res.status}` }
      }

      const html = await res.text()
      const urls = extractNorteTicketUrls(html)

      const events: FutureEvent[] = []
      
      // Fetch each event page sequentially with a small delay to be polite
      for (const url of urls) {
        try {
          const evRes = await fetchWithRetry(url, { method: 'GET' })
          if (evRes.ok) {
            const evHtml = await evRes.text()
            const event = parseNorteTicketEventHTML(evHtml, url, query)
            if (event) {
              events.push(event)
            }
          }
          // Polite delay
          await new Promise(r => setTimeout(r, 1000))
        } catch (e) {
          console.error(`Failed to scrape NorteTicket event at ${url}:`, e)
        }
      }

      return {
        events,
        total: events.length
      }
    } catch (error) {
      console.error('NorteTicket adapter error:', error)
      return { events: [], total: 0, error: 'Failed to scrape NorteTicket' }
    }
  }
}

export function extractNorteTicketUrls(html: string): string[] {
  const $ = cheerio.load(html)
  const urls = new Set<string>()

  $('.owl-carousel .item a').each((_, el) => {
    const href = $(el).attr('href')
    if (href && href.startsWith('https://norteticket.com/') && href !== 'https://norteticket.com/' && !href.includes('?buscar=')) {
      urls.add(href)
    }
  })

  return Array.from(urls)
}

export function parseNorteTicketEventHTML(html: string, url: string, query: ExternalSearchRequest): FutureEvent | null {
  const $ = cheerio.load(html)
  const jsonldScript = $('script[type="application/ld+json"]').html()
  
  if (!jsonldScript) return null

  let data
  try {
    data = JSON.parse(jsonldScript)
  } catch {
    return null
  }

  // Handle both array of schemas and single schema
  const eventData = Array.isArray(data) ? data.find(d => d['@type'] === 'Event') : (data['@type'] === 'Event' ? data : null)
  
  if (!eventData) return null

  const title = eventData.name || ''
  
  if (query.keyword && !title.toLowerCase().includes(query.keyword.toLowerCase())) {
    return null
  }

  const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 8)
  
  return {
    id: `norteticket-${hash}`,
    title,
    datetime: eventData.startDate || '',
    venue: {
      name: eventData.location?.name || 'NorteTicket',
      city: query.city || null
    },
    lineup: [],
    url,
    image: eventData.image || ''
  }
}
