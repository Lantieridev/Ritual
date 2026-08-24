import { describe, it, expect } from 'vitest';
import fs from 'fs'
import path from 'path'
import { parseAllAccessHTML } from './allaccess'

describe('AllAccess Adapter', () => {
  it('should parse events from HTML fixture', () => {
    const html = fs.readFileSync(path.join(__dirname, '__fixtures__', 'allaccess.html'), 'utf8')
    const events = parseAllAccessHTML(html, {})
    
    expect(events.length).toBeGreaterThan(0)
    
    const firstEvent = events[0]
    expect(firstEvent.title).toBeTruthy()
    expect(firstEvent.url).toContain('allaccess.com.ar')
  })

  it('should filter events by keyword', () => {
    const html = fs.readFileSync(path.join(__dirname, '__fixtures__', 'allaccess.html'), 'utf8')
    const events = parseAllAccessHTML(html, { keyword: 'RAXXET' }) // Example from previous dump
    
    expect(events.length).toBeGreaterThan(0)
    expect(events.every(e => e.title.toUpperCase().includes('RAXXET'))).toBe(true)
  })

  it('should return empty array for invalid HTML', () => {
    const events = parseAllAccessHTML('<html><body></body></html>', {})
    expect(events).toEqual([])
  })
})
