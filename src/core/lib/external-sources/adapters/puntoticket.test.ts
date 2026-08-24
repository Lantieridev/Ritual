import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parsePuntoTicketHTML } from './puntoticket'

describe('PuntoTicket Adapter', () => {
  it('should parse events from HTML fixture correctly', () => {
    const html = fs.readFileSync(path.join(__dirname, '__fixtures__', 'puntoticket.html'), 'utf-8')
    const events = parsePuntoTicketHTML(html, {})

    expect(events.length).toBeGreaterThan(0)
    expect(events[0]).toMatchObject({
      title: 'Colo-Colo vs. Unión Española',
      venue: { name: 'PuntoTicket', city: null },
      datetime: '26 de agosto 2026',
      url: 'https://www.puntoticket.com/evento/colo-colo-vs-u-espanola-copachile',
      image: 'https://example.com/colocolo.jpg'
    })
    
    expect(events[0].id).toMatch(/^puntoticket-[a-f0-9]{10}$/)
  })

  it('should filter by keyword', () => {
    const html = fs.readFileSync(path.join(__dirname, '__fixtures__', 'puntoticket.html'), 'utf-8')
    const events = parsePuntoTicketHTML(html, { keyword: 'colo-colo' })
    expect(events.length).toBe(1)
    
    const eventsEmpty = parsePuntoTicketHTML(html, { keyword: 'no match' })
    expect(eventsEmpty.length).toBe(0)
  })
})
