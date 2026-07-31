interface TicketEmbedProps {
  material?: 'hierro' | 'papel'
  artistLine1: string
  artistLine2?: string
  venue: string
  address?: string
  when: string
  seat?: string
  seatShort?: string
  date: string
  rz?: number
  zoom?: number
  className?: string
  title?: string
}

/**
 * El talón 3D del handoff de diseño (three.js procedural, ver
 * public/tickets/README-ish en ticket-hierro.html/ticket-papel.html).
 * Vive como iframe same-origin a propósito: portarlo a un componente React
 * con three.js de npm es trabajo aparte (ver tarea de sistema de diseño);
 * como iframe ya funciona en la app real porque carga three.js desde unpkg
 * con conexión a internet — el bloqueo del handoff era solo para el export
 * HTML standalone offline, no para la app corriendo.
 */
export function TicketEmbed({
  material = 'hierro',
  artistLine1,
  artistLine2,
  venue,
  address,
  when,
  seat,
  seatShort,
  date,
  rz,
  zoom,
  className = '',
  title = 'Entrada',
}: TicketEmbedProps) {
  const params = new URLSearchParams({ a1: artistLine1, venue, when, date })
  if (artistLine2) params.set('a2', artistLine2)
  if (address) params.set('addr', address)
  if (seat) params.set('seat', seat)
  if (seatShort) params.set('seatS', seatShort)
  if (rz !== undefined) params.set('rz', String(rz))
  if (zoom !== undefined) params.set('zoom', String(zoom))

  const src = `/tickets/ticket-${material}.html?${params.toString()}`

  return (
    <iframe
      src={src}
      title={title}
      className={className}
      style={{ border: 'none', background: 'transparent' }}
      loading="lazy"
    />
  )
}
