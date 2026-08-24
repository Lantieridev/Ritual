import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parseKonexHTML } from './konex'

describe('Konex Adapter', () => {
  it('should parse events from HTML fixture correctly', () => {
    const html = fs.readFileSync(path.join(__dirname, '__fixtures__', 'konex.html'), 'utf-8')
    const events = parseKonexHTML(html, {})

    expect(events.length).toBeGreaterThan(0)
    expect(events[0]).toMatchObject({
      title: 'La Bomba de Tiempo',
      venue: { name: 'Ciudad Cultural Konex', city: 'Buenos Aires' },
      url: 'https://entradas.cckonex.org/event/la-bomba-de-tiempo-2026'
    })
    
    expect(events[0].id).toMatch(/^konex-[a-f0-9]{10}$/)
  })

  it('should filter by keyword', () => {
    const html = fs.readFileSync(path.join(__dirname, '__fixtures__', 'konex.html'), 'utf-8')
    const events = parseKonexHTML(html, { keyword: 'cumbia' })
    expect(events.length).toBe(1)
    
    const eventsEmpty = parseKonexHTML(html, { keyword: 'no match' })
    expect(eventsEmpty.length).toBe(0)
  })
})
