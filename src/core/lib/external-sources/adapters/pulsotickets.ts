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

    const titleEl = $(el).find('h3')
    const title = titleEl.text().trim()

    // Bug real, confirmado contra el HTML en vivo: el sitio repite el mismo
    // evento en dos `div.group` (un carrusel de banners sin h3, y la card
    // real con título/fecha/venue). Antes se marcaba la url como "vista"
    // apenas aparecía, así que la primera tarjeta -vacía, sin título- ganaba
    // la carrera y la segunda -la única con datos- se descartaba por
    // duplicada. Con un solo evento cargado en el sitio esto vaciaba el
    // resultado entero sin ningún error. Ahora sólo se marca como vista una
    // vez que la tarjeta efectivamente aportó un evento válido.
    if (!title) return
    seenUrls.add(url)

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
