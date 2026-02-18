import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { getEventById } from '@/src/domains/events/data'
import { deleteEvent } from '@/src/domains/events/actions'
import { getAttendanceForEvent } from '@/src/domains/events/attendance-data'
import { getEventPhotos } from '@/src/domains/events/photo-actions'
import { routes } from '@/src/core/lib/routes'
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
    description: `${event.name || 'Recital'} — ${new Date(event.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })} · ${venueLabel}`,
  }
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params
  const [event, attendance, photos] = await Promise.all([
    getEventById(id),
    getAttendanceForEvent(id),
    getEventPhotos(id),
  ])

  if (!event) notFound()

  // Buscar imagen del artista principal en Spotify
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
  const dateLabel = dateObj.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const isPast = dateObj < new Date()

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans">
      {/* Hero con imagen de Spotify */}
      <div className="relative h-72 md:h-96 w-full overflow-hidden bg-neutral-900">
        {heroImage ? (
          <Image
            src={heroImage}
            alt={mainArtist?.name ?? 'Artista'}
            fill
            className="object-cover object-top"
            priority
            sizes="100vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-transparent" />

        {/* Nav sobre la imagen */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-6">
          <Link
            href={routes.home}
            className="inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition-colors bg-black/30 backdrop-blur-sm rounded-lg px-3 py-1.5"
          >
            ← Volver
          </Link>
          <LinkButton
            href={routes.events.edit(event.id)}
            variant="secondary"
            className="px-4 py-1.5 text-sm bg-black/30 backdrop-blur-sm"
          >
            Editar
          </LinkButton>
        </div>

        {/* Título sobre la imagen */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-1">
            {dateLabel}
          </p>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white text-balance">
            {event.name || mainArtist?.name || 'Recital'}
          </h1>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-3xl mx-auto px-6 md:px-8 py-10 space-y-10">

        {/* Estado de asistencia */}
        <section>
          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">
            {isPast ? '¿Fuiste?' : '¿Vas a ir?'}
          </p>
          <AttendanceStatusButtons
            eventId={event.id}
            currentStatus={attendance?.status ?? null}
            isPast={isPast}
          />
        </section>

        {/* Info del evento */}
        <section className="grid sm:grid-cols-2 gap-6 border-t border-white/[0.06] pt-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Sede</p>
            <p className="text-lg font-semibold text-white">{venueLabel}</p>
            {event.venues?.country && (
              <p className="text-sm text-zinc-500 mt-0.5">{event.venues.country}</p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Fecha</p>
            <p className="text-lg font-semibold text-white">{dateLabel}</p>
          </div>
        </section>

        {/* Lineup */}
        {event.lineups && event.lineups.length > 0 && (
          <section className="border-t border-white/[0.06] pt-8">
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-4">Lineup</p>
            <ul className="flex flex-wrap gap-2">
              {event.lineups.map((row) => (
                <li key={row.artists.id}>
                  <span className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/10 text-zinc-200 font-medium px-4 py-2 rounded-lg text-sm">
                    {row.artists.name}
                    {row.artists.genre && (
                      <span className="text-zinc-600 font-normal text-xs">
                        {row.artists.genre}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Galería de fotos */}
        <section className="border-t border-white/[0.06] pt-8">
          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-4">
            Fotos {photos.length > 0 && <span className="text-zinc-700">({photos.length})</span>}
          </p>
          <PhotoGallery eventId={event.id} initialPhotos={photos} />
        </section>

        {/* Rating, reseña y notas — visible cuando el status es "went" */}
        {attendance?.status === 'went' && (
          <section className="border-t border-white/[0.06] pt-8">
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-4">Tu memoria del show</p>

            {/* Mostrar rating guardado */}
            {attendance?.memory?.rating && (
              <div className="flex gap-0.5 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={`text-xl ${star <= (attendance.memory?.rating ?? 0) ? 'text-white' : 'text-zinc-700'}`}
                  >
                    ★
                  </span>
                ))}
              </div>
            )}

            {/* Mostrar reseña guardada */}
            {attendance?.memory?.review && (
              <p className="text-zinc-300 text-sm italic mb-4 border-l-2 border-white/10 pl-4">
                &quot;{attendance.memory.review}&quot;
              </p>
            )}

            {/* Mostrar notas guardadas */}
            {attendance?.memory?.notes && (
              <div className="mb-6 rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Notas / Setlist</p>
                <pre className="text-sm text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed">
                  {attendance.memory.notes}
                </pre>
              </div>
            )}

            <RatingAndReviewForm
              eventId={event.id}
              initialRating={attendance?.memory?.rating}
              initialReview={attendance?.memory?.review}
              initialNotes={attendance?.memory?.notes}
            />
          </section>
        )}

        {/* Zona de peligro */}
        <section className="border-t border-white/[0.06] pt-8">
          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Acciones</p>
          <DeleteEventButton event={event} deleteEvent={deleteEvent} />
        </section>
      </div>
    </main>
  )
}
