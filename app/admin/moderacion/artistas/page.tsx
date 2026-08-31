import { getClient } from '@/src/graphql/client'
import { cache } from 'react'
import { ModerationActions } from '@/src/domains/moderation/components'

interface UnverifiedArtist {
  id: string
  name: string
  genre: string | null
  status: string | null
}

const GET_UNVERIFIED_ARTISTS = `
  query getUnverifiedArtists {
    unverifiedArtists {
      id
      name
      genre
      status
    }
  }
`

const loadArtists = cache(async () => {
  const result = await getClient().query(GET_UNVERIFIED_ARTISTS, {}).toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.unverifiedArtists ?? []
})

export default async function ModerationArtistsPage() {
  const artists = await loadArtists()

  return (
    <div className="p-6 md:p-10 max-w-5xl">
      <div className="mb-10">
        <p className="font-label text-[10px] tracking-[0.32em] text-ritual-red-hover uppercase">Pendientes</p>
        <h1 className="font-display text-5xl uppercase text-ritual-bone mt-2">
          Artistas
        </h1>
        <p className="font-body italic text-ritual-gray-text mt-2">
          Cargados por la comunidad. Revisar o fusionar con los originales.
        </p>
      </div>

      {artists.length === 0 ? (
        <div className="border border-dashed border-ritual-border-subtle p-12 text-center">
          <p className="font-dense text-ritual-gray-light-2 uppercase">Todo limpio por acá.</p>
        </div>
      ) : (
        <div className="bg-ritual-surface border border-ritual-border overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-ritual-panel border-b border-ritual-border-subtle">
              <tr>
                <th className="px-6 py-4 font-label text-[10px] tracking-[0.14em] text-ritual-gray-text uppercase w-1/3">Nombre</th>
                <th className="px-6 py-4 font-label text-[10px] tracking-[0.14em] text-ritual-gray-text uppercase w-1/4">Género</th>
                <th className="px-6 py-4 font-label text-[10px] tracking-[0.14em] text-ritual-gray-text uppercase text-right w-5/12">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ritual-border-subtle">
              {artists.map((artist: UnverifiedArtist) => (
                <tr key={artist.id} className="group hover:bg-ritual-bg transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-dense font-extrabold text-ritual-bone uppercase">{artist.name}</p>
                    <p className="font-label text-[10px] text-ritual-gray-light-2">{artist.id}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-body text-sm text-ritual-gray-text">{artist.genre || '—'}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ModerationActions entityType="artists" id={artist.id} name={artist.name} />
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
