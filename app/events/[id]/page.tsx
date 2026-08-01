import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { getEventById } from '@/src/domains/events/data'
import { deleteEvent } from '@/src/domains/events/actions'
import { getAttendanceForEvent } from '@/src/domains/events/attendance-data'
import { getEventPhotos } from '@/src/domains/events/photo-actions'
import { getExpensesForEvent } from '@/src/domains/expenses/data'
import { getCurrentUserId } from '@/src/core/auth/session'
import { routes } from '@/src/core/lib/routes'
import { isPastEvent } from '@/src/core/lib/dates'
import { formatDate } from '@/src/core/lib/utils'
import { getExpenseCategory } from '@/src/domains/expenses/categories'
import { LinkButton } from '@/src/core/components/ui'
import { DeleteEventButton } from '@/src/domains/events/components'
import { AttendanceStatusButtons } from '@/src/domains/events/components/AttendanceStatusButtons'
import { RatingAndReviewForm } from '@/src/domains/events/components/RatingAndReviewForm'
import { PhotoGallery } from '@/src/domains/events/components/PhotoGallery'
import { searchSpotifyArtist, getBestSpotifyImage, isSpotifyConfigured } from '@/src/core/lib/spotify'

interface EventDetailPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: EventDetailPageProps): Promise<Metadata> {
  const { id } = await params
  const event = await getEventById(id)
  if (!event) return { title: 'Recital no encontrado | RITUAL' }
  const venueLabel = event.venues
    ? [event.venues.name, event.venues.city].filter(Boolean).join(', ')
    : 'Sede por confirmar'
  return {
    title: `${event.name || 'Recital'} | RITUAL`,
    description: `${event.name || 'Recital'} — ${formatDate(event.date)} · ${venueLabel}`,
  }
}

function formatARS(amount: number) {
  return `$${amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params
  const userId = await getCurrentUserId()
  const [event, attendance, photos, expenses] = await Promise.all([
    getEventById(id),
    getAttendanceForEvent(id),
    getEventPhotos(id),
    getExpensesForEvent(id, userId),
  ])

  if (!event) notFound()

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

  const review = attendance?.review?.trim() || null
  const reviewVariant = !review ? 'none' : review.length > 220 ? 'long' : 'short'
  const expensesTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  return (
    <main className="min-h-screen bg-ritual-bg text-ritual-bone">
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
        {/* Banda de asistencia */}
        <section>
          <p className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-3">
            {isPast ? '¿Fuiste?' : '¿Vas a ir?'}
          </p>
          <AttendanceStatusButtons eventId={event.id} currentStatus={attendance?.status ?? null} isPast={isPast} />
        </section>

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

        {/* La cuenta de esa noche */}
        {expenses.length > 0 && (
          <section className="border-t border-ritual-border-subtle pt-8">
            <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-4">La cuenta de esa noche</h2>
            <div className="bg-ritual-paper text-ritual-paper-ink px-6 py-6 border-l-[3px] border-ritual-paper-red">
              <ul className="divide-y divide-ritual-paper-2">
                {expenses.map((ex) => (
                  <li key={ex.id} className="flex items-center justify-between py-2 font-label text-sm">
                    <span>{getExpenseCategory(ex.category).icon} {ex.category}</span>
                    <span>{formatARS(Number(ex.amount))}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between pt-3 mt-2 border-t border-dashed border-ritual-paper-2 font-figure text-2xl">
                <span>TOTAL</span>
                <span>{formatARS(expensesTotal)}</span>
              </div>
              <p className="font-label text-[9px] tracking-[0.1em] uppercase text-ritual-paper-ink/50 mt-3">no se aceptan devoluciones</p>
            </div>
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

        {/* Zona de peligro */}
        <section className="border-t border-ritual-border-subtle pt-8">
          <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-3">Acciones</h2>
          <DeleteEventButton event={event} deleteEvent={deleteEvent} />
        </section>
      </div>
    </main>
  )
}
