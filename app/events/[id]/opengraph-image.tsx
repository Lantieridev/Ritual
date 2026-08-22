import { ImageResponse } from 'next/og'
import { getEventById } from '@/src/domains/events/data'
import { formatDate } from '@/src/core/lib/utils'

export const alt = 'Recital en RITUAL'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const event = await getEventById(id)

  const mainArtist = event?.lineups?.[0]?.artists?.name
  const title = event?.name || mainArtist || 'Recital'
  const venue = event?.venues
    ? [event.venues.name, event.venues.city].filter(Boolean).join(', ')
    : 'Sede por confirmar'
  const dateStr = event?.date ? formatDate(event.date) : ''
  const performers = event?.lineups?.map((l) => l.artists.name).filter(Boolean).join(', ')

  return new ImageResponse(
    (
      <div
        style={{
          background: '#09090b',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px',
          fontFamily: 'sans-serif',
          color: '#f4f4f5',
          border: '8px solid #dc2626',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: '0.2em', color: '#dc2626' }}>
            RITUAL
          </span>
          <span style={{ fontSize: 24, color: '#a1a1aa', letterSpacing: '0.1em' }}>
            {dateStr}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h1
            style={{
              fontSize: 64,
              fontWeight: 900,
              textTransform: 'uppercase',
              margin: 0,
              lineHeight: 1.1,
              color: '#ffffff',
            }}
          >
            {title}
          </h1>
          <p style={{ fontSize: 32, color: '#a1a1aa', margin: 0 }}>
            {venue}
          </p>
          {performers && performers !== title && (
            <p style={{ fontSize: 22, color: '#71717a', margin: 0 }}>
              Lineup: {performers}
            </p>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid #27272a',
            paddingTop: '24px',
          }}
        >
          <span style={{ fontSize: 20, color: '#71717a' }}>Agenda de recitales y memoria en vivo</span>
          <span style={{ fontSize: 20, color: '#dc2626', fontWeight: 700 }}>RITUAL</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
