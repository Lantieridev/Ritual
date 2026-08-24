import { describe, it, expect } from 'vitest';
import fs from 'fs'
import path from 'path'
import { extractNorteTicketUrls, parseNorteTicketEventHTML } from './norteticket'

describe('NorteTicket Adapter', () => {
  it('should extract urls from home HTML fixture', () => {
    const html = fs.readFileSync(path.join(__dirname, '__fixtures__', 'norteticket.html'), 'utf8')
    const urls = extractNorteTicketUrls(html)
    
    expect(urls.length).toBe(2)
    expect(urls).toContain('https://norteticket.com/CONOCIENDO-RUSIA-EN-JUJUY/')
    expect(urls).toContain('https://norteticket.com/MARCELA-MORELO-EN-JUJUY-2026/')
  })

  it('should parse event from event HTML fixture', () => {
    const html = fs.readFileSync(path.join(__dirname, '__fixtures__', 'norteticket_event.html'), 'utf8')
    const event = parseNorteTicketEventHTML(html, 'https://norteticket.com/CONOCIENDO-RUSIA-EN-JUJUY/', {})
    
    expect(event).toBeTruthy()
    expect(event?.title).toBe('CONOCIENDO RUSIA EN JUJUY')
    expect(event?.venue.name).toBe('Centro Cultural Martin Fierro')
    expect(event?.datetime).toBe('2026-09-22T22:00:00-03:00')
    expect(event?.id).toMatch(/^norteticket-[a-f0-9]{8}$/)
  })

  it('should filter events by keyword', () => {
    const html = fs.readFileSync(path.join(__dirname, '__fixtures__', 'norteticket_event.html'), 'utf8')
    const event = parseNorteTicketEventHTML(html, 'https://norteticket.com/CONOCIENDO-RUSIA-EN-JUJUY/', { keyword: 'RUSIA' })
    expect(event).toBeTruthy()
    
    const eventEmpty = parseNorteTicketEventHTML(html, 'https://norteticket.com/CONOCIENDO-RUSIA-EN-JUJUY/', { keyword: 'METALLICA' })
    expect(eventEmpty).toBeNull()
  })

  it('should return null for invalid HTML', () => {
    const event = parseNorteTicketEventHTML('<html><body></body></html>', 'https://norteticket.com/CONOCIENDO-RUSIA-EN-JUJUY/', {})
    expect(event).toBeNull()
  })
})
