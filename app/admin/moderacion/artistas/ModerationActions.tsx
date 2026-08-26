'use client'

import { useState } from 'react'
import { useMutation } from 'urql'
import { useRouter } from 'next/navigation'

const APPROVE_ARTIST = `
  mutation ApproveArtist($id: ID!) {
    approveArtist(id: $id) { success }
  }
`

const MERGE_ARTISTS = `
  mutation MergeArtists($sourceId: ID!, $targetId: ID!) {
    mergeArtists(sourceId: $sourceId, targetId: $targetId) { success }
  }
`

export function ArtistModerationActions({ artistId, artistName }: { artistId: string, artistName: string }) {
  const router = useRouter()
  const [, approve] = useMutation(APPROVE_ARTIST)
  const [, merge] = useMutation(MERGE_ARTISTS)
  const [isMerging, setIsMerging] = useState(false)
  const [targetId, setTargetId] = useState('')

  const handleApprove = async () => {
    if (!confirm(`¿Aprobar a ${artistName}?`)) return
    await approve({ id: artistId })
    router.refresh()
  }

  const handleMerge = async () => {
    if (!targetId) return
    if (!confirm(`¿Estás seguro de que querés fusionar ${artistName} hacia el ID ${targetId}? Esta acción destruirá el registro original.`)) return
    await merge({ sourceId: artistId, targetId })
    setIsMerging(false)
    router.refresh()
  }

  if (isMerging) {
    return (
      <div className="flex items-center gap-2 justify-end">
        <input 
          type="text" 
          placeholder="ID canónico destino..." 
          className="bg-ritual-bg border border-ritual-border-subtle text-ritual-bone px-3 py-1 text-xs w-48 focus:outline-none focus:border-ritual-red-hover"
          value={targetId}
          onChange={e => setTargetId(e.target.value)}
        />
        <button onClick={handleMerge} className="font-label text-[10px] tracking-[0.16em] text-green-500 hover:text-green-400 uppercase transition-colors">
          Confirmar
        </button>
        <button onClick={() => setIsMerging(false)} className="font-label text-[10px] tracking-[0.16em] text-ritual-gray-text hover:text-ritual-bone uppercase transition-colors">
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <div className="space-x-4">
      <button onClick={handleApprove} className="font-label text-[10px] tracking-[0.16em] text-ritual-bone hover:text-green-500 uppercase transition-colors">
        ✓ Aprobar
      </button>
      <button onClick={() => setIsMerging(true)} className="font-label text-[10px] tracking-[0.16em] text-ritual-bone hover:text-ritual-red-hover uppercase transition-colors">
        Fusionar...
      </button>
    </div>
  )
}
