'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import Image from 'next/image'
import { uploadEventPhoto, deleteEventPhoto } from '@/src/domains/events/photo-actions'
import type { EventPhoto } from '@/src/domains/events/photo-actions'

interface PhotoGalleryProps {
    eventId: string
    initialPhotos: EventPhoto[]
}

export function PhotoGallery({ eventId, initialPhotos }: PhotoGalleryProps) {
    const [photos, setPhotos] = useState<EventPhoto[]>(initialPhotos)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [lightbox, setLightbox] = useState<EventPhoto | null>(null)
    const [isPending, startTransition] = useTransition()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const closeButtonRef = useRef<HTMLButtonElement>(null)
    const lastTriggerRef = useRef<HTMLElement | null>(null)

    useEffect(() => {
        if (!lightbox) return

        closeButtonRef.current?.focus()

        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') setLightbox(null)
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            lastTriggerRef.current?.focus()
        }
    }, [lightbox])

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        setError(null)
        setUploading(true)

        const formData = new FormData()
        formData.append('eventId', eventId)
        formData.append('file', file)

        startTransition(async () => {
            const result = await uploadEventPhoto(formData)
            if (result.error) {
                setError(result.error)
            } else if (result.photo) {
                setPhotos((prev) => [...prev, result.photo!])
            }
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        })
    }

    async function handleDelete(photo: EventPhoto) {
        setDeletingId(photo.id)
        startTransition(async () => {
            const result = await deleteEventPhoto(photo.id, eventId)
            if (result.error) {
                setError(result.error)
            } else {
                setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
                if (lightbox?.id === photo.id) setLightbox(null)
            }
            setDeletingId(null)
        })
    }

    return (
        <div className="space-y-4">
            {/* Grid de fotos */}
            {photos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {photos.map((photo) => (
                        <div key={photo.id} className="group relative aspect-square overflow-hidden bg-ritual-surface">
                            <button
                                type="button"
                                onClick={(e) => {
                                    lastTriggerRef.current = e.currentTarget
                                    setLightbox(photo)
                                }}
                                aria-label={photo.caption ? `Ver foto ampliada: ${photo.caption}` : 'Ver foto ampliada'}
                                className="absolute inset-0 w-full h-full"
                            >
                                <Image
                                    src={photo.url}
                                    alt={photo.caption ?? 'Foto del show'}
                                    fill
                                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                                    sizes="(max-width: 640px) 50vw, 33vw"
                                />
                            </button>
                            {/* Overlay con botón eliminar */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end justify-end p-2 opacity-0 group-hover:opacity-100 pointer-events-none">
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleDelete(photo) }}
                                    disabled={deletingId === photo.id || isPending}
                                    aria-label="Eliminar foto"
                                    className="pointer-events-auto font-label text-xs bg-ritual-red/90 hover:bg-ritual-red text-ritual-panel px-2 py-1 transition-colors disabled:opacity-50"
                                >
                                    {deletingId === photo.id ? '…' : '✕'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload button */}
            <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 cursor-pointer border border-ritual-border bg-ritual-surface hover:bg-ritual-surface-high px-4 py-2 font-label text-[10px] tracking-[0.1em] uppercase text-ritual-gray-text hover:text-ritual-bone transition-all">
                    <span>{uploading ? 'Subiendo…' : '+ Agregar foto'}</span>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        onChange={handleUpload}
                        disabled={uploading || isPending}
                    />
                </label>
                <p className="font-label text-xs text-ritual-gray-mid">JPG, PNG, WebP · máx. 5MB</p>
            </div>

            {error && (
                <p className="font-body text-sm text-ritual-red bg-ritual-red/10 border border-ritual-red/20 px-3 py-2">
                    {error}
                </p>
            )}

            {/* Lightbox */}
            {lightbox && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={lightbox.caption ?? 'Foto del show'}
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setLightbox(null)}
                >
                    <div className="relative max-w-3xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
                        <Image
                            src={lightbox.url}
                            alt={lightbox.caption ?? 'Foto del show'}
                            width={1200}
                            height={800}
                            className="object-contain max-h-[80vh] w-full rounded-lg"
                        />
                        {lightbox.caption && (
                            <p className="text-center text-sm text-zinc-400 mt-3">{lightbox.caption}</p>
                        )}
                        <button
                            ref={closeButtonRef}
                            type="button"
                            onClick={() => setLightbox(null)}
                            aria-label="Cerrar"
                            className="absolute -top-3 -right-3 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full text-white text-sm flex items-center justify-center transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
