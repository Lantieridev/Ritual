import { getClient } from '@/src/graphql/client'
import { cache } from 'react'

interface UnverifiedEvent {
  id: string
  name: string | null
  date: string
  status: string | null
  venue: { name: string } | null
  lineups: Array<{ artist: { name: string } | null }> | null
}
import { formatDate } from '@/src/core/lib/utils'

const GET_UNVERIFIED_EVENTS = `
  query getUnverifiedEvents {
    unverifiedEvents {
      id
      name
      date
      status
      venue {
        name
      }
      lineups {
        artist {
          name
        }
      }
    }
  }
`

const loadEvents = cache(async () => {
  const result = await getClient().query(GET_UNVERIFIED_EVENTS, {}).toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.unverifiedEvents ?? []
})

export default async function ModerationEventsPage() {
  const events = await loadEvents()

  return (
    <div className="p-6 md:p-10 max-w-5xl">
      <div className="mb-10">
        <p className="font-label text-[10px] tracking-[0.32em] text-ritual-red-hover uppercase">Pendientes</p>
        <h1 className="font-display text-5xl uppercase text-ritual-bone mt-2">
          Eventos
        </h1>
        <p className="font-body italic text-ritual-gray-text mt-2">
          Recitales creados a mano que no vinieron por APIs externas.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="border border-dashed border-ritual-border-subtle p-12 text-center">
          <p className="font-dense text-ritual-gray-light-2 uppercase">Todo limpio por acá.</p>
        </div>
      ) : (
        <div className="bg-ritual-surface border border-ritual-border overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-ritual-panel border-b border-ritual-border-subtle">
              <tr>
                <th className="px-6 py-4 font-label text-[10px] tracking-[0.14em] text-ritual-gray-text uppercase">Evento / Headliner</th>
                <th className="px-6 py-4 font-label text-[10px] tracking-[0.14em] text-ritual-gray-text uppercase">Sede & Fecha</th>
                <th className="px-6 py-4 font-label text-[10px] tracking-[0.14em] text-ritual-gray-text uppercase text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ritual-border-subtle">
              {events.map((ev: UnverifiedEvent) => {
                const title = ev.name || ev.lineups?.[0]?.artist?.name || 'Evento sin nombre'
                return (
                  <tr key={ev.id} className="group hover:bg-ritual-bg transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-dense font-extrabold text-ritual-bone uppercase">{title}</p>
                      <p className="font-label text-[10px] text-ritual-gray-light-2">{ev.id}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-body text-sm text-ritual-gray-text uppercase">{ev.venue?.name || 'Sin Sede'}</p>
                      <p className="font-label text-[10px] text-ritual-gray-light-2 mt-1">
                        {formatDate(ev.date, { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right space-x-4">
                      <button className="font-label text-[10px] tracking-[0.16em] text-ritual-bone hover:text-green-500 uppercase transition-colors">
                        ✓ Aprobar
                      </button>
                      <button className="font-label text-[10px] tracking-[0.16em] text-ritual-bone hover:text-ritual-red-hover uppercase transition-colors">
                        Fusionar...
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
