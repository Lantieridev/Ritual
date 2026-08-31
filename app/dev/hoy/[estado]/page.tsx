import { notFound } from 'next/navigation'
import { HomeHero } from '@/src/domains/events/components/HomeHero'
import { SuggestionsStrip } from '@/src/domains/recommendations/components/SuggestionsStrip'
import type { HomeHeroState } from '@/src/domains/events/home-view'
import {
  mockEvent,
  mockEventSinDatos,
  STRIP_PERSONAL_HEADING,
  STRIP_PERSONAL_CANDIDATES,
  STRIP_GENERAL_HEADING,
  STRIP_GENERAL_CANDIDATES,
  STRIP_SIN_DISTANCIA_HEADING,
  STRIP_SIN_DISTANCIA_CANDIDATES,
  SEEDS_GENEROS,
  SEEDS_PAIS,
  SEEDS_ARRANQUE,
} from './fixtures'

/**
 * The three "strip-*" states (issue #81) preview `SuggestionsStrip` under a
 * representative `HomeHero` — the same placement Unit 5 wires into the real
 * home page, before that wiring lands.
 */
const STRIP_STATE_FIXTURES = {
  'strip-personal': { heading: STRIP_PERSONAL_HEADING, candidates: STRIP_PERSONAL_CANDIDATES },
  'strip-general': { heading: STRIP_GENERAL_HEADING, candidates: STRIP_GENERAL_CANDIDATES },
  'strip-sin-distancia': { heading: STRIP_SIN_DISTANCIA_HEADING, candidates: STRIP_SIN_DISTANCIA_CANDIDATES },
} as const

/** The first-time seed ladder's three tiers (issue #81), one harness state per `pickSeeds` outcome. */
const SEED_STATE_FIXTURES = {
  'first-time-semillas-generos': SEEDS_GENEROS,
  'first-time-semillas-pais': SEEDS_PAIS,
  'first-time-semillas-arranque': SEEDS_ARRANQUE,
} as const

export default async function DevHoyPage({ params }: { params: Promise<{ estado: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()

  const { estado } = await params

  if (estado in SEED_STATE_FIXTURES) {
    const seeds = SEED_STATE_FIXTURES[estado as keyof typeof SEED_STATE_FIXTURES]
    return <HomeHero state={{ kind: 'first-time' }} backgroundImage={null} seeds={Promise.resolve(seeds)} />
  }

  if (estado in STRIP_STATE_FIXTURES) {
    const { heading, candidates } = STRIP_STATE_FIXTURES[estado as keyof typeof STRIP_STATE_FIXTURES]
    return (
      <>
        <HomeHero state={{ kind: 'normal', nextShow: mockEvent, daysUntil: 5 }} backgroundImage={null} />
        <SuggestionsStrip heading={heading} candidates={candidates} />
      </>
    )
  }

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
