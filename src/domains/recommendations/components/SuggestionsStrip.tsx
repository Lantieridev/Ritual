/**
 * The home ranking strip (issue #81) — replaces "Cerca tuyo" and "En tu
 * ciudad" with one section. 1:1 with the mock (`Ritual Mobile.dc.html`
 * lines 146-167), tokens only. Purely presentational: `heading` and
 * `candidates` are already-resolved data, `stripHeading()` is the only pure
 * logic called here (title/note text).
 */
import Link from 'next/link'
import { routes } from '@/src/core/lib/routes'
import { formatDate } from '@/src/core/lib/utils'
import { stripHeading } from '@/src/domains/recommendations/heading'
import type { StripHeadingInput } from '@/src/domains/recommendations/types'

export interface SuggestionsStripCandidate {
  key: string
  href: string
  headliner: string
  venueName: string
  /** ISO date/datetime — the card badge derives its short "day mon" label from this. */
  startsAt: string
  /** Already formatted via `formatReason` — `null` renders no reason line. */
  reason: string | null
  image: string | null
}

export interface SuggestionsStripProps {
  heading: StripHeadingInput
  candidates: readonly SuggestionsStripCandidate[]
}

const SECTION_CLASSES = 'bg-ritual-bg md:min-h-screen md:snap-start md:flex md:flex-col md:justify-center md:px-10 md:py-20'
const CARD_CLASSES =
  'group relative flex h-full w-full flex-col justify-end overflow-hidden border border-ritual-mobile-line p-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ritual-red'

function SuggestionCard({ candidate }: { candidate: SuggestionsStripCandidate }) {
  const when = formatDate(candidate.startsAt, { day: 'numeric', month: 'short' })

  return (
    <li className="h-[286px] w-[228px] flex-none motion-safe:transition-[flex-basis] motion-safe:duration-500 md:h-[52vh] md:w-auto md:basis-64 md:hover:basis-96">
      <Link href={candidate.href} className={CARD_CLASSES}>
        <div aria-hidden="true" className="absolute inset-0 ritual-photo-fallback" />
        {candidate.image && (
          <div
            aria-hidden="true"
            className="absolute inset-0 ritual-photo ritual-photo-bg motion-safe:transition-transform motion-safe:duration-700 group-hover:scale-105"
            style={{ backgroundImage: `url(${candidate.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
        )}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ritual-panel from-[5%] to-ritual-panel/10 to-[60%]" />
        <p className="font-display text-[25px] leading-[0.92] uppercase text-ritual-bone">{candidate.headliner}</p>
        <p className="font-label text-[9px] tracking-[0.1em] uppercase text-ritual-gray-text mt-[6px]">{candidate.venueName}</p>
        <time
          dateTime={candidate.startsAt}
          className="absolute left-3 top-3 bg-ritual-red px-2 font-figure text-[17px] tracking-[0.06em] text-ritual-panel"
        >
          {when}
        </time>
        {candidate.reason && <p className="font-body italic text-[12px] text-ritual-red mt-[2px]">{candidate.reason}</p>}
      </Link>
    </li>
  )
}

export function SuggestionsStrip({ heading, candidates }: SuggestionsStripProps) {
  const { title, note } = stripHeading(heading)

  return (
    <section aria-labelledby="suggestions-strip-heading" className={SECTION_CLASSES}>
      <div className="flex items-end justify-between gap-[14px] px-5 pt-[22px] md:mb-10 md:flex-wrap md:gap-4 md:px-0 md:pt-0">
        <div>
          <h2 id="suggestions-strip-heading" className="font-display text-[28px] leading-[0.9] uppercase text-ritual-bone md:text-[7vh]">
            {title}
          </h2>
          <p className="font-label text-[9px] tracking-[0.14em] uppercase text-ritual-gray-mid-2 mt-2">{note}</p>
        </div>
        <Link
          href={routes.events.search}
          className="inline-flex min-h-[44px] items-end pb-[3px] font-label text-[9px] tracking-[0.16em] uppercase text-ritual-gray-text border-b border-ritual-mobile-line"
        >
          Ver todo
        </Link>
      </div>
      <ul role="list" className="flex gap-3 overflow-x-auto px-5 pt-[14px] pb-1 md:h-[52vh] md:px-0 md:pt-0 md:pb-0">
        {candidates.map((candidate) => (
          <SuggestionCard key={candidate.key} candidate={candidate} />
        ))}
      </ul>
    </section>
  )
}

export function SuggestionsStripSkeleton() {
  return (
    <section role="status" aria-labelledby="suggestions-strip-skeleton-heading" className={SECTION_CLASSES}>
      <span id="suggestions-strip-skeleton-heading" className="sr-only">
        Buscando shows para vos
      </span>
      <div aria-hidden="true" className="px-5 pt-[22px] md:px-0 md:pt-0">
        <div className="h-[25px] w-40 bg-ritual-surface" />
        <div className="h-[9px] w-56 bg-ritual-surface mt-3" />
      </div>
      <div aria-hidden="true" className="flex gap-3 overflow-x-hidden px-5 pt-[14px] pb-1 md:px-0 md:pt-0">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[286px] w-[228px] flex-none border border-ritual-mobile-line bg-ritual-surface md:h-[52vh] md:w-auto md:basis-64" />
        ))}
      </div>
    </section>
  )
}
