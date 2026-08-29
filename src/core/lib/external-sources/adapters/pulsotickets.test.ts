import { describe, it, expect } from 'vitest';
import fs from 'fs'
import path from 'path'
import { parsePulsoTicketsHTML } from './pulsotickets'

describe('PulsoTickets Adapter', () => {
  // Bug real, encontrado contra el sitio en vivo (no en este fixture, que
  // originalmente sólo tenía la card válida): pulsotickets.com repite el
  // mismo evento en un carrusel de banners sin h3 antes de la card real con
  // título/fecha/venue. El fixture ahora incluye esa card decoy primero,
  // igual que el HTML real, para no volver a perder esta regresión.
  it('parses the real event even when a decoy carousel card without a title shares its url', () => {
    const html = fs.readFileSync(path.join(__dirname, '__fixtures__', 'pulsotickets.html'), 'utf8')
    const events = parsePulsoTicketsHTML(html, {})

    expect(events.length).toBeGreaterThan(0)

    const firstEvent = events[0]
    expect(firstEvent.title).toBe('PopFest 101.5')
    expect(firstEvent.url).toContain('pulsotickets.com')
    expect(firstEvent.datetime).toBe('Diciembre 2026')
    expect(firstEvent.venue.name).toBe('Parque Norte')
    expect(firstEvent.id).toMatch(/^pulsotickets-[a-f0-9]{8}$/)
  })

  it('should filter events by keyword', () => {
    const html = fs.readFileSync(path.join(__dirname, '__fixtures__', 'pulsotickets.html'), 'utf8')
    const events = parsePulsoTicketsHTML(html, { keyword: 'POPFEST' })
    expect(events.length).toBe(1)
    
    const eventsEmpty = parsePulsoTicketsHTML(html, { keyword: 'Metallica' })
    expect(eventsEmpty.length).toBe(0)
  })

  it('should return empty array for invalid HTML', () => {
    const events = parsePulsoTicketsHTML('<html><body></body></html>', {})
    expect(events).toEqual([])
  })
})
