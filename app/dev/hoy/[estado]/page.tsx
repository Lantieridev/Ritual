import { notFound } from 'next/navigation'
import { HomeHero } from '@/src/domains/events/components/HomeHero'
import type { EventWithAttendance } from '@/src/domains/events/service'
import type { HomeHeroState } from '@/src/domains/events/home-view'

const mockEvent: EventWithAttendance = {
  id: 'e-123',
  name: 'Mock Show',
  date: new Date().toISOString(),
  venue_id: 'v-123',
  venues: { name: 'Mock Venue', city: 'Buenos Aires', country: 'Argentina' },
  lineups: [{ artists: { id: 'a-1', name: 'Mock Artist', genre: 'Rock' }, b2b_group: null }],
  attendance: [{ id: 'att-1', status: 'going', user_id: 'u-1', rating: null, review: null }]
}

// Fixture del hero mobile de Hoy sin dirección, clima ni "Lo último que
// viste": prueba en mano y en e2e que esas secciones se omiten enteras en
// vez de mostrar un placeholder inventado.
const mockEventSinDatos: EventWithAttendance = {
  ...mockEvent,
  venues: { name: 'Mock Venue', city: 'Buenos Aires', country: 'Argentina' },
}

export default async function DevHoyPage({ params }: { params: Promise<{ estado: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()

  const { estado } = await params

  let state: HomeHeroState
  switch (estado) {
    case 'guest':
      state = { kind: 'guest', event: mockEvent }
      break
    case 'guest-sin-show':
      state = { kind: 'guest', event: undefined }
      break
    case 'first-time':
      state = { kind: 'first-time' }
      break
    case 'past-only':
      state = { kind: 'past-only', event: mockEvent, yearsAgo: 1 }
      break
    case 'past-only-sin-efemeride':
      state = { kind: 'past-only', event: mockEvent, yearsAgo: null }
      break
    case 'morning-after':
      state = { kind: 'morning-after', event: mockEvent }
      break
    case 'normal':
      state = { kind: 'normal', nextShow: mockEvent, daysUntil: 5 }
      break
    case 'show-today':
      state = { kind: 'show-today', event: mockEvent }
      break
    case 'normal-sin-datos':
      state = { kind: 'normal', nextShow: mockEventSinDatos, daysUntil: 5 }
      break
    case 'show-today-sin-datos':
      state = { kind: 'show-today', event: mockEventSinDatos }
      break
    default:
      notFound()
  }

  return <HomeHero state={state} backgroundImage={null} />
}
