import { getClient } from '@/src/graphql/client'
import { cache } from 'react'

interface UnverifiedVenue {
  id: string
  name: string
  city: string | null
  address: string | null
  status: string | null
}

const GET_UNVERIFIED_VENUES = `
  query getUnverifiedVenues {
    unverifiedVenues {
      id
      name
      city
      address
      status
    }
  }
`

const loadVenues = cache(async () => {
  const result = await getClient().query(GET_UNVERIFIED_VENUES, {}).toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.unverifiedVenues ?? []
})

export default async function ModerationVenuesPage() {
  const venues = await loadVenues()

  return (
    <div className="p-6 md:p-10 max-w-5xl">
      <div className="mb-10">
        <p className="font-label text-[10px] tracking-[0.32em] text-ritual-red-hover uppercase">Pendientes</p>
        <h1 className="font-display text-5xl uppercase text-ritual-bone mt-2">
          Sedes
        </h1>
        <p className="font-body italic text-ritual-gray-text mt-2">
          Lugares y estadios cargados a mano por la comunidad.
        </p>
      </div>

      {venues.length === 0 ? (
        <div className="border border-dashed border-ritual-border-subtle p-12 text-center">
          <p className="font-dense text-ritual-gray-light-2 uppercase">Todo limpio por acá.</p>
        </div>
      ) : (
        <div className="bg-ritual-surface border border-ritual-border overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-ritual-panel border-b border-ritual-border-subtle">
              <tr>
                <th className="px-6 py-4 font-label text-[10px] tracking-[0.14em] text-ritual-gray-text uppercase">Nombre</th>
                <th className="px-6 py-4 font-label text-[10px] tracking-[0.14em] text-ritual-gray-text uppercase">Ubicación</th>
                <th className="px-6 py-4 font-label text-[10px] tracking-[0.14em] text-ritual-gray-text uppercase text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ritual-border-subtle">
              {venues.map((venue: UnverifiedVenue) => (
                <tr key={venue.id} className="group hover:bg-ritual-bg transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-dense font-extrabold text-ritual-bone uppercase">{venue.name}</p>
                    <p className="font-label text-[10px] text-ritual-gray-light-2">{venue.id}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-body text-sm text-ritual-gray-text">
                      {venue.city ? `${venue.city}` : ''}
                      {venue.address ? ` — ${venue.address}` : ''}
                      {!venue.city && !venue.address && '—'}
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
