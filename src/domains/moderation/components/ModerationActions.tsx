'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useClient } from 'urql'
import { useRouter } from 'next/navigation'

export type ModeratedEntity = 'artists' | 'venues' | 'events'

const APPROVE_FIELD: Record<ModeratedEntity, string> = {
    artists: 'approveArtist',
    venues: 'approveVenue',
    events: 'approveEvent',
}

const MERGE_FIELD: Record<ModeratedEntity, string> = {
    artists: 'mergeArtists',
    venues: 'mergeVenues',
    events: 'mergeEvents',
}

const APPROVE_MUTATIONS: Record<ModeratedEntity, string> = {
    artists: `mutation ApproveArtist($id: ID!) { approveArtist(id: $id) { success error } }`,
    venues: `mutation ApproveVenue($id: ID!) { approveVenue(id: $id) { success error } }`,
    events: `mutation ApproveEvent($id: ID!) { approveEvent(id: $id) { success error } }`,
}

const MERGE_MUTATIONS: Record<ModeratedEntity, string> = {
    artists: `mutation MergeArtists($sourceId: ID!, $targetId: ID!) { mergeArtists(sourceId: $sourceId, targetId: $targetId) { success error } }`,
    venues: `mutation MergeVenues($sourceId: ID!, $targetId: ID!) { mergeVenues(sourceId: $sourceId, targetId: $targetId) { success error } }`,
    events: `mutation MergeEvents($sourceId: ID!, $targetId: ID!) { mergeEvents(sourceId: $sourceId, targetId: $targetId) { success error } }`,
}

const MERGE_TARGETS_QUERY = `
  query MergeTargets($entityType: ModeratedEntity!, $query: String!, $excludeId: ID) {
    mergeTargets(entityType: $entityType, query: $query, excludeId: $excludeId) {
      id
      name
      detail
    }
  }
`

interface MergeTargetOption {
    id: string
    name: string
    detail: string | null
}

interface MutationResultPayload {
    success: boolean
    error?: string | null
}

interface ModerationActionsProps {
    entityType: ModeratedEntity
    id: string
    name: string
}

const SEARCH_DEBOUNCE_MS = 250

/**
 * Acciones de moderación (aprobar / fusionar) para artistas, sedes y
 * eventos. Compartido entre las tres pantallas — el contrato GraphQL es
 * idéntico salvo el nombre del campo (ver `mergeTargets`, único por diseño
 * en moderation.ts).
 *
 * El buscador de destino usa `mergeTargets` en vez de un campo de texto para
 * el ID: pedirle a un moderador que copie y pegue un UUID a mano es el
 * flujo que el spec de fase 2 quiso evitar con esta query.
 */
export function ModerationActions({ entityType, id, name }: ModerationActionsProps) {
    const router = useRouter()
    const client = useClient()
    const [, approve] = useMutation(APPROVE_MUTATIONS[entityType])
    const [, merge] = useMutation(MERGE_MUTATIONS[entityType])

    const [error, setError] = useState<string | null>(null)
    const [isMerging, setIsMerging] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [query, setQuery] = useState('')
    const [target, setTarget] = useState<MergeTargetOption | null>(null)
    const [options, setOptions] = useState<MergeTargetOption[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    useEffect(() => {
        return () => clearTimeout(debounceRef.current)
    }, [])

    function handleQueryChange(value: string) {
        setQuery(value)
        setTarget(null)
        clearTimeout(debounceRef.current)
        if (value.trim().length < 2) {
            setOptions([])
            return
        }
        debounceRef.current = setTimeout(async () => {
            setIsSearching(true)
            const result = await client
                .query(MERGE_TARGETS_QUERY, { entityType, query: value.trim(), excludeId: id })
                .toPromise()
            setIsSearching(false)
            setOptions(result.data?.mergeTargets ?? [])
        }, SEARCH_DEBOUNCE_MS)
    }

    async function handleApprove() {
        if (!confirm(`¿Aprobar a ${name}?`)) return
        setError(null)
        setIsSubmitting(true)
        const result = await approve({ id })
        setIsSubmitting(false)
        const payload = result.data?.[APPROVE_FIELD[entityType]] as MutationResultPayload | undefined
        if (result.error || !payload?.success) {
            setError(payload?.error || result.error?.message || 'No se pudo aprobar.')
            return
        }
        router.refresh()
    }

    async function handleMerge() {
        if (!target) return
        if (
            !confirm(
                `¿Fusionar "${name}" hacia "${target.name}"? Esta acción destruye el registro original y mueve su historial al destino.`
            )
        )
            return
        setError(null)
        setIsSubmitting(true)
        const result = await merge({ sourceId: id, targetId: target.id })
        setIsSubmitting(false)
        const payload = result.data?.[MERGE_FIELD[entityType]] as MutationResultPayload | undefined
        if (result.error || !payload?.success) {
            setError(payload?.error || result.error?.message || 'No se pudo fusionar.')
            return
        }
        setIsMerging(false)
        router.refresh()
    }

    if (isMerging) {
        return (
            <div className="flex flex-col items-end gap-2">
                <div className="relative w-64">
                    <input
                        type="text"
                        placeholder="Buscar destino por nombre..."
                        className="w-full bg-ritual-bg border border-ritual-border-subtle text-ritual-bone px-3 py-1 text-xs focus:outline-none focus:border-ritual-red-hover"
                        value={target ? target.name : query}
                        onChange={(e) => handleQueryChange(e.target.value)}
                        autoFocus
                    />
                    {query.trim().length >= 2 && !target && (
                        <ul className="absolute z-10 mt-1 w-full bg-ritual-surface border border-ritual-border max-h-48 overflow-y-auto text-left">
                            {isSearching && (
                                <li className="px-3 py-2 text-xs text-ritual-gray-text">Buscando...</li>
                            )}
                            {!isSearching && options.length === 0 && (
                                <li className="px-3 py-2 text-xs text-ritual-gray-text">Sin coincidencias.</li>
                            )}
                            {options.map((option) => (
                                <li key={option.id}>
                                    <button
                                        type="button"
                                        onClick={() => setTarget(option)}
                                        className="w-full text-left px-3 py-2 text-xs text-ritual-bone hover:bg-ritual-bg"
                                    >
                                        {option.name}
                                        {option.detail && (
                                            <span className="text-ritual-gray-text"> — {option.detail}</span>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleMerge}
                        disabled={!target || isSubmitting}
                        className="font-label text-[10px] tracking-[0.16em] text-green-500 hover:text-green-400 uppercase transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                        Confirmar
                    </button>
                    <button
                        onClick={() => {
                            setIsMerging(false)
                            setQuery('')
                            setTarget(null)
                            setError(null)
                        }}
                        className="font-label text-[10px] tracking-[0.16em] text-ritual-gray-text hover:text-ritual-bone uppercase transition-colors"
                    >
                        Cancelar
                    </button>
                </div>
                {error && <p className="text-[10px] text-ritual-red-hover max-w-64 text-right">{error}</p>}
            </div>
        )
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <div className="space-x-4">
                <button
                    onClick={handleApprove}
                    disabled={isSubmitting}
                    className="font-label text-[10px] tracking-[0.16em] text-ritual-bone hover:text-green-500 uppercase transition-colors disabled:opacity-40"
                >
                    ✓ Aprobar
                </button>
                <button
                    onClick={() => setIsMerging(true)}
                    className="font-label text-[10px] tracking-[0.16em] text-ritual-bone hover:text-ritual-red-hover uppercase transition-colors"
                >
                    Fusionar...
                </button>
            </div>
            {error && <p className="text-[10px] text-ritual-red-hover max-w-64 text-right">{error}</p>}
        </div>
    )
}
