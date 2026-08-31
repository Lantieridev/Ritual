import type { EventWithAttendance } from '@/src/domains/events/service'
import type { SuggestionsStripCandidate } from '@/src/domains/recommendations/components/SuggestionsStrip'
import type { StripHeadingInput } from '@/src/domains/recommendations/types'

export const mockEvent: EventWithAttendance = {
  id: 'e-123',
  name: 'Mock Show',
  date: new Date().toISOString(),
  venue_id: 'v-123',
  venues: { name: 'Mock Venue', city: 'Buenos Aires', country: 'Argentina' },
  lineups: [{ artists: { id: 'a-1', name: 'Mock Artist', genre: 'Rock' }, b2b_group: null }],
  attendance: [{ id: 'att-1', status: 'going', user_id: 'u-1', rating: null, review: null }],
}

// Fixture del hero mobile de Hoy sin dirección, clima ni "Lo último que
// viste": prueba en mano y en e2e que esas secciones se omiten enteras en
// vez de mostrar un placeholder inventado.
export const mockEventSinDatos: EventWithAttendance = {
  ...mockEvent,
  venues: { name: 'Mock Venue', city: 'Buenos Aires', country: 'Argentina' },
}

function daysFromNow(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

/** Issue #81 — home ranking strip harness states. */
export const STRIP_PERSONAL_HEADING: StripHeadingInput = {
  basis: 'behavior',
  hasCoords: true,
  city: 'La Plata',
  sources: ['lastfm'],
  declaredGenreLabels: [],
}

export const STRIP_PERSONAL_CANDIDATES: SuggestionsStripCandidate[] = [
  {
    key: 'strip-personal-1',
    href: '/events/strip-personal-1',
    headliner: 'Divididos',
    venueName: 'Estadio Obras',
    startsAt: daysFromNow(6),
    reason: 'lo viste 2 veces · a 4 km',
    image: null,
  },
  {
    key: 'strip-personal-2',
    href: '/events/strip-personal-2',
    headliner: 'El Mató a un Policía Motorizado',
    venueName: 'Groove',
    startsAt: daysFromNow(12),
    reason: 'está en tu wishlist · a 9 km',
    image: null,
  },
  {
    key: 'strip-personal-3',
    href: '/events/strip-personal-3',
    headliner: 'Nathy Peluso',
    venueName: 'Movistar Arena',
    startsAt: daysFromNow(21),
    reason: null,
    image: null,
  },
]

export const STRIP_GENERAL_HEADING: StripHeadingInput = {
  basis: 'none',
  hasCoords: false,
  city: null,
  sources: [],
  declaredGenreLabels: [],
}

export const STRIP_GENERAL_CANDIDATES: SuggestionsStripCandidate[] = [
  {
    key: 'strip-general-1',
    href: '/events/strip-general-1',
    headliner: 'Trueno',
    venueName: 'Luna Park',
    startsAt: daysFromNow(8),
    reason: 'de los más escuchados del país',
    image: null,
  },
  {
    key: 'strip-general-2',
    href: '/events/strip-general-2',
    headliner: 'Wos',
    venueName: 'Estadio Vélez',
    startsAt: daysFromNow(15),
    reason: 'lo cargaron 12 personas',
    image: null,
  },
]

/** Issue #81 — first-time seed ladder harness states, one per `pickSeeds` tier. */
export const SEEDS_GENEROS = {
  names: ['Bandalos Chinos', 'El Mató a un Policía Motorizado', 'Usted Señálemelo'],
  note: 'De los géneros que elegiste',
}

export const SEEDS_PAIS = {
  names: ['Divididos', 'Babasónicos', 'Wos'],
  note: 'Los más escuchados y cargados del país · completá el registro para afinarlo',
}

export const SEEDS_ARRANQUE = {
  names: ['Divididos', 'Babasónicos', 'Wos', 'Trueno', 'Dillom', 'Las Pelotas'],
  note: 'Para arrancar',
}

/** Personal, but city geocoding hasn't resolved yet — no distance anywhere (JD-003). */
export const STRIP_SIN_DISTANCIA_HEADING: StripHeadingInput = {
  basis: 'declared-genres',
  hasCoords: false,
  city: 'Rosario',
  sources: [],
  declaredGenreLabels: ['Rock', 'Indie'],
}

export const STRIP_SIN_DISTANCIA_CANDIDATES: SuggestionsStripCandidate[] = [
  {
    key: 'strip-sin-distancia-1',
    href: '/events/strip-sin-distancia-1',
    headliner: 'Bandalos Chinos',
    venueName: 'Niceto Club',
    startsAt: daysFromNow(10),
    reason: 'por los géneros que elegiste',
    image: null,
  },
  {
    key: 'strip-sin-distancia-2',
    href: '/events/strip-sin-distancia-2',
    headliner: 'Conociendo Rusia',
    venueName: 'C Art Media',
    startsAt: daysFromNow(18),
    reason: 'por los géneros que elegiste',
    image: null,
  },
]
