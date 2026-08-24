import { describe, it, expect } from 'vitest';
import fs from 'fs'
import path from 'path'
import { parseLivepassHTML } from './livepass'

describe('Livepass Adapter', () => {
  it('should parse events from HTML fixture', () => {
    const html = fs.readFileSync(path.join(__dirname, '__fixtures__', 'livepass.html'), 'utf8')
    const events = parseLivepassHTML(html, {})
    
    expect(events.length).toBeGreaterThan(0)
    
    const firstEvent = events[0]
    expect(firstEvent.title).toBeTruthy()
    expect(firstEvent.url).toContain('livepass.com.ar')
  })

  it('should filter events by keyword', () => {
    const html = fs.readFileSync(path.join(__dirname, '__fixtures__', 'livepass.html'), 'utf8')
    const events = parseLivepassHTML(html, { keyword: 'IRON MAIDEN' }) 
    
    expect(events.length).toBeGreaterThan(0)
    expect(events.every(e => e.title.toUpperCase().includes('IRON MAIDEN'))).toBe(true)
  })

  it('should return empty array for invalid HTML', () => {
    const events = parseLivepassHTML('<html><body></body></html>', {})
    expect(events).toEqual([])
  })
})
