import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { findEventById, getAttendanceForEvent, getEventPhotos } from '@/src/domains/events/service'

import { getCurrentUserId } from '@/src/core/auth/session'
import { routes } from '@/src/core/lib/routes'
import { isPastEvent } from '@/src/core/lib/dates'
import { formatDate } from '@/src/core/lib/utils'
import { safeHref } from '@/src/core/lib/validation'
import { LinkButton } from '@/src/core/components/ui'
import { DeleteEventAction, EventWeather } from '@/src/domains/events/components'
import { EventExpensesPanel } from '@/src/domains/expenses/components'
import { AttendanceStatusButtons } from '@/src/domains/events/components/AttendanceStatusButtons'
import { RatingAndReviewForm } from '@/src/domains/events/components/RatingAndReviewForm'
import { PhotoGallery } from '@/src/domains/events/components/PhotoGallery'
import { searchSpotifyArtist, getBestSpotifyImage, isSpotifyConfigured } from '@/src/core/lib/spotify'
import { generateEventJsonLd } from '@/src/domains/events/jsonld'
import { getEventWeather } from '@/src/domains/weather/weather-service'
import { getClient } from '@/src/graphql/client'
import { gql } from 'urql'
import { getEventShowModeState } from '@/src/domains/showmode/service'
import { buildMemoryCard } from '@/src/domains/showmode/memory-card'
import {
  setChecklistItemChecked,
  addEventChecklistItem,
  removeEventChecklistItem,
} from '@/src/domains/showmode/actions'
import {
  ShowModeBanner,
  PreShowChecklist,
  PendingShowPrompt,
  MemoryCard,
} from '@/src/domains/showmode/components'

const EventDetailPageQuery = gql`
  query EventDetailPage($eventId: ID!) {
    expenses(eventId: $eventId) {
      id amount category note date eventId
    }
    estimateSpendForEvent(eventId: $eventId) {
      averageTotal
      eventsConsidered
    }
  }
`

interface EventDetailPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: EventDetailPageProps): Promise<Metadata> {
  const { id } = await params
  const event = await findEventById(id)
  if (!event) return { title: 'Recital no encontrado | RITUAL' }
  const mainArtist = event.lineups?.[0]?.artists?.name
  const title = event.name || mainArtist || 'Recital'
  const venueLabel = event.venues
    ? [event.venues.name, event.venues.city].filter(Boolean).join(', ')
    : 'Sede por confirmar'
  const description = `${title} — ${formatDate(event.date)} · ${venueLabel}`

  let heroImage: string | undefined = undefined
  if (mainArtist && isSpotifyConfigured()) {
    const { artist: spotifyArtist } = await searchSpotifyArtist(mainArtist)
    heroImage = spotifyArtist ? (getBestSpotifyImage(spotifyArtist.images) ?? undefined) : undefined
  }

  return {
    title: `${title} | RITUAL`,
    description,
    openGraph: {
      title: `${title} | RITUAL`,
      description,
      type: 'website',
      ...(heroImage ? { images: [{ url: heroImage }] } : {}),
    },
  }
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params
  const userId = await getCurrentUserId()
  const [event, attendance, photos] = await Promise.all([
    findEventById(id),
    getAttendanceForEvent(id),
    getEventPhotos(id),
  ])

  if (!event) notFound()

  const { data } = await getClient().query(EventDetailPageQuery, { eventId: id }).toPromise()
  const expenses = data?.expenses ?? []
  const spendEstimate = data?.estimateSpendForEvent ?? null

  const mainArtist = event.lineups?.[0]?.artists
  let heroImage: string | null = null
  if (mainArtist && isSpotifyConfigured()) {
    const { artist: spotifyArtist } = await searchSpotifyArtist(mainArtist.name)
    heroImage = spotifyArtist ? getBestSpotifyImage(spotifyArtist.images) : null
  }

  const venueLabel = event.venues
    ? [event.venues.name, event.venues.city].filter(Boolean).join(', ')
    : 'Sede por confirmar'

  const dateObj = new Date(event.date)
  const dateLabel = formatDate(dateObj, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const isPast = isPastEvent(event.date)

  // Clima exacto del show — ubicación de la sede, hora del evento (issue
  // #8). Se degrada solo si la sede no tiene lat/lng cargado o Open-Meteo
  // no responde — getEventWeather nunca lanza.
  const hasVenueCoords = event.venues?.lat != null && event.venues?.lng != null
  const weather = await getEventWeather({ date: event.date }, event.venues)

  const review = attendance?.review?.trim() || null
  const reviewVariant = !review ? 'none' : review.length > 220 ? 'long' : 'short'
  const jsonLd = generateEventJsonLd(event)
  const expensesDefaultDate = String(event.date).slice(0, 10)

  // Modo recital activo — issue #9. La ventana se resuelve contra el rango
  // real del show (el festival completo si el evento es un día de uno) y con
  // la configuración del usuario. Recibe la asistencia y los gastos ya
  // cargados arriba en vez de volver a pedirlos.
  const showMode = await getEventShowModeState(event, userId, {
    attendanceStatus: attendance?.status ?? null,
    expenseCount: expenses.length,
    rating: attendance?.rating ?? null,
    review: attendance?.review ?? null,
  })
  const showsChecklist =
    userId !== null && (showMode.window.phase === 'before' || showMode.window.phase === 'during')
  // La tarjeta recuerdo tiene sentido recién con el show pasado y confirmado:
  // antes de eso no hay nada que recordar. Se ofrece incluso con pendientes
  // (avisando cuáles), en vez de esconderla hasta que esté todo perfecto.
  const showsMemoryCard = userId !== null && isPast && attendance?.status === 'went'
  const memoryCard = showsMemoryCard
    ? buildMemoryCard({
        event,
        expenses,
        rating: attendance?.rating ?? null,
        review: attendance?.review ?? null,
        weather,
      })
    : null

  return (
    <main className="min-h-screen bg-ritual-bg text-ritual-bone">
      <script
        type="application/ld+json"
        // JSON.stringify doesn't escape "<" — a stored event/artist/venue name containing
        // "</script>" would otherwise break out of this tag and inject arbitrary script.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      {/* Hero */}
      <div className="relative h-72 md:h-[28rem] w-full overflow-hidden bg-ritual-panel">
        {heroImage ? (
          <div className="absolute inset-0 ritual-photo">
            <Image src={heroImage} alt={mainArtist?.name ?? 'Artista'} fill className="object-cover object-top" priority sizes="100vw" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-ritual-panel-2 to-ritual-bg" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ritual-bg via-ritual-bg/60 to-transparent" />

        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-6">
          <Link
            href={routes.home}
            className="font-label text-[10px] tracking-[0.14em] uppercase text-ritual-gray-light-3 hover:text-ritual-bone transition-colors bg-ritual-bg/40 backdrop-blur-sm px-3 py-1.5"
          >
            ← Volver
          </Link>
          <LinkButton href={routes.events.edit(event.id)} variant="secondary" className="px-4 py-1.5 bg-ritual-bg/40 backdrop-blur-sm">
            Editar
          </LinkButton>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <p className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-light-2 mb-1">{dateLabel}</p>
          <h1 className="font-display text-4xl md:text-7xl leading-[0.9] uppercase text-ritual-bone">
            {event.name || mainArtist?.name || 'Recital'}
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 md:px-8 py-10 space-y-10">
        {/* Modo recital activo — issue #9. Solo aparece dentro de la ventana. */}
        {userId && <ShowModeBanner window={showMode.window} phaseLabel={showMode.phaseLabel} />}

        {/* Recordatorio post-show, todo junto en un solo aviso in-app — issue #9 */}
        {userId && showMode.window.phase === 'after' && (
          <PendingShowPrompt pending={showMode.pending} />
        )}

        {/* Banda de asistencia */}
        <section>
          <p className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-3">
            {isPast ? '¿Fuiste?' : '¿Vas a ir?'}
          </p>
          <AttendanceStatusButtons eventId={event.id} currentStatus={attendance?.status ?? null} isPast={isPast} />
        </section>

        {/* Entradas — link manual (AllAccess, Passline, etc.), no hay búsqueda automática, ver issue #19 */}
        {!isPast && safeHref(event.ticket_url) && (
          <section>
            <a
              href={safeHref(event.ticket_url)!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center font-label text-[10px] tracking-[0.14em] uppercase bg-ritual-red text-ritual-bone hover:bg-ritual-red-hover transition-colors px-6 py-3"
            >
              Comprar entradas →
            </a>
          </section>
        )}

        {/* Info */}
        <section className="grid sm:grid-cols-2 gap-6 border-t border-ritual-border-subtle pt-8">
          <div>
            <p className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-1">Sede</p>
            <p className="font-subtitle font-black text-xl uppercase text-ritual-bone">{venueLabel}</p>
            {event.venues?.country && <p className="font-body text-sm text-ritual-gray-text mt-0.5">{event.venues.country}</p>}
          </div>
          <div>
            <p className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-1">Fecha</p>
            <p className="font-subtitle font-black text-xl uppercase text-ritual-bone">{dateLabel}</p>
          </div>
        </section>

        {/* Clima exacto del show — ver issue #8 */}
        <EventWeather weather={weather} hasVenueCoords={hasVenueCoords} isPast={isPast} />

        {/* Checklist pre-show — issue #9, solo mientras la ventana previa está abierta */}
        {showsChecklist && (
          <section className="border-t border-ritual-border-subtle pt-8">
            <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-4">
              Antes de salir
            </h2>
            <PreShowChecklist
              eventId={event.id}
              initialItems={showMode.checklist}
              setChecked={setChecklistItemChecked}
              addItem={addEventChecklistItem}
              removeItem={removeEventChecklistItem}
            />
          </section>
        )}

        {/* Lineup — quién tocó */}
        {event.lineups && event.lineups.length > 0 && (
          <section className="border-t border-ritual-border-subtle pt-8">
            <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-4">Quién tocó</h2>
            <ul className="flex flex-wrap gap-2">
              {event.lineups.map((row) => (
                <li key={row.artists.id}>
                  <span className="inline-flex items-center gap-2 bg-ritual-surface border border-ritual-border text-ritual-gray-light-3 font-dense font-extrabold px-4 py-2 text-sm">
                    {row.artists.name}
                    {row.artists.genre && <span className="font-label text-ritual-gray-text font-normal text-xs">{row.artists.genre}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* El recorte — reseña */}
        {reviewVariant !== 'none' && (
          <section className="border-t border-ritual-border-subtle pt-8">
            <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-4">Tu reseña</h2>
            <div
              className="bg-ritual-paper text-ritual-paper-ink border-l-[3px] border-ritual-paper-red px-6 py-6 md:px-8 md:py-8"
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% 97%, 98% 100%, 94% 97%, 90% 100%, 86% 97%, 82% 100%, 78% 97%, 74% 100%, 70% 97%, 66% 100%, 62% 97%, 58% 100%, 54% 97%, 50% 100%, 46% 97%, 42% 100%, 38% 97%, 34% 100%, 30% 97%, 26% 100%, 22% 97%, 18% 100%, 14% 97%, 10% 100%, 6% 97%, 2% 100%, 0 97%)' }}
            >
              {reviewVariant === 'long' ? (
                <p className="font-body text-lg leading-relaxed first-letter:font-display first-letter:text-6xl first-letter:text-ritual-paper-red first-letter:float-left first-letter:mr-3 first-letter:leading-[0.8]">
                  {review}
                </p>
              ) : (
                <p className="font-body italic text-2xl leading-snug">&ldquo;{review}&rdquo;</p>
              )}
            </div>
          </section>
        )}
        {reviewVariant === 'none' && attendance?.status === 'went' && (
          <section className="border-t border-ritual-border-subtle pt-8">
            <p className="font-body italic text-ritual-gray-text">
              Todavía no escribiste nada de esta noche — no hace falta, pero si querés, ahí abajo hay lugar.
            </p>
          </section>
        )}

        {/* Fotos */}
        <section className="border-t border-ritual-border-subtle pt-8">
          <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-4">
            Fotos {photos.length > 0 && <span className="text-ritual-gray-text">({photos.length})</span>}
          </h2>
          <PhotoGallery eventId={event.id} initialPhotos={photos} />
        </section>

        {/* Quiénes fueron — depende de la capa social, todavía sin backend */}
        <section className="border-t border-ritual-border-subtle pt-8">
          <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-3">Quiénes fueron</h2>
          <p className="font-body text-sm text-ritual-gray-text">
            Próximamente — depende de la capa social (
            <a href="https://github.com/Lantieridev/Ritual/issues/5" target="_blank" rel="noopener noreferrer" className="text-ritual-red-hover underline underline-offset-4">
              issue #5
            </a>
            ), todavía sin implementar.
          </p>
        </section>

        {/* La cuenta de esa noche — issue #7: resumen inline + carga rápida, sin salir de la página */}
        {userId && (
          <section className="border-t border-ritual-border-subtle pt-8">
            <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-4">La cuenta de esa noche</h2>
            <EventExpensesPanel
              eventId={event.id}
              initialExpenses={expenses}
              defaultDate={expensesDefaultDate}
              spendEstimate={spendEstimate}
              detailHref={routes.events.expenses(event.id)}
            />
          </section>
        )}

        {/* Rating, reseña y notas — form, solo si fue */}
        {attendance?.status === 'went' && (
          <section className="border-t border-ritual-border-subtle pt-8">
            <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-4">Tu memoria del show</h2>
            {attendance?.notes && (
              <div className="mb-6 bg-ritual-surface border border-ritual-border-subtle px-4 py-3">
                <p className="font-label text-[9px] tracking-[0.14em] uppercase text-ritual-gray-text mb-2">Notas / Setlist</p>
                <pre className="font-label text-sm text-ritual-gray-text whitespace-pre-wrap leading-relaxed">{attendance.notes}</pre>
              </div>
            )}
            <RatingAndReviewForm
              eventId={event.id}
              initialRating={attendance?.rating}
              initialReview={attendance?.review}
              initialNotes={attendance?.notes}
            />
          </section>
        )}

        {/* Tarjeta recuerdo — issue #9. Stub de entrada digital, descargable
            como imagen. No es una función social: no se publica ni se comparte. */}
        {memoryCard && (
          <section className="border-t border-ritual-border-subtle pt-8">
            <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-4">
              Tarjeta recuerdo
            </h2>
            <MemoryCard
              card={memoryCard}
              pendingLabels={showMode.pending.map((item) => item.label)}
            />
          </section>
        )}

        {/* Zona de peligro */}
        <section className="border-t border-ritual-border-subtle pt-8">
          <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-3">Acciones</h2>
          <DeleteEventAction event={event} />
        </section>
      </div>
    </main>
  )
}
