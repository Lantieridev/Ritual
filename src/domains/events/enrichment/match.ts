import { toDateOnly, eventTimeOfDay } from '@/src/core/lib/dates'
import type { FutureEvent } from '@/src/core/types'

/** Lo que se sabe del show cargado a mano, lo mínimo para reconocerlo en Ticketmaster. */
export interface ShowToMatch {
  date: string
  venueName: string | null
  venueCity: string | null
}

function normalize(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function sameVenueName(a: string, b: string): boolean {
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

/**
 * El único candidato de Ticketmaster que es, con confianza, el show cargado:
 * misma fecha local y misma ciudad o sede. Con cero o varios candidatos
 * devuelve null — un falso positivo (pegarle al show la hora o el póster de
 * otro) es peor que no completar nada.
 */
export function findConfidentMatch(show: ShowToMatch, candidates: FutureEvent[]): FutureEvent | null {
  const day = toDateOnly(show.date)
  const city = normalize(show.venueCity)
  const venue = normalize(show.venueName)

  const matches = candidates.filter((candidate) => {
    if (!candidate.datetime || toDateOnly(candidate.datetime) !== day) return false
    const candidateCity = normalize(candidate.venue.city)
    const sameCity = city !== '' && candidateCity !== '' && city === candidateCity
    return sameCity || sameVenueName(venue, normalize(candidate.venue.name))
  })

  return matches.length === 1 ? matches[0] : null
}

/**
 * Cuando Ticketmaster no manda hora, ticketmaster.ts rellena la medianoche
 * local (`T00:00:00-03:00`), así que un 00:00 no es una hora real y no se
 * puede usar para completar la del show.
 */
export function hasRealTime(candidate: FutureEvent): boolean {
  if (!candidate.datetime) return false
  return eventTimeOfDay(candidate.datetime) !== '00:00'
}
