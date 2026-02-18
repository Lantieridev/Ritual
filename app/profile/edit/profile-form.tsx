'use client'

import { useActionState, useState, useEffect } from 'react'
import { updateProfile, ProfileState } from '@/src/domains/auth/profile-actions'
import { Button } from '@/src/core/components/ui/Button'
import { Input } from '@/src/core/components/ui/Input'
import { Textarea } from '@/src/core/components/ui/Textarea'
import { Profile } from '@/src/core/types'
import Link from 'next/link'

interface ProfileFormProps {
    user: { id: string, email?: string }
    profile: Profile | null
}

const initialState: ProfileState = {
    message: '',
    error: '',
    success: ''
}

export function ProfileForm({ user, profile }: ProfileFormProps) {
    const [state, formAction, isPending] = useActionState(updateProfile, initialState)
    const [previewUrl, setPreviewUrl] = useState<string | null>(profile?.avatar_url || null)

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const url = URL.createObjectURL(file)
            setPreviewUrl(url)
        }
    }

    return (
        <form action={formAction} className="space-y-8">
            <input type="hidden" name="current_avatar_url" value={profile?.avatar_url || ''} />

            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-neutral-900 border border-white/10 shrink-0 relative group">
                    {previewUrl ? (
                        <img
                            src={previewUrl}
                            alt="Avatar Preview"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl text-zinc-700 font-bold select-none">
                            {(profile?.full_name?.[0] || user.email?.[0] || '?').toUpperCase()}
                        </div>
                    )}

                    {/* Overlay for upload hint */}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <span className="text-xs text-white font-medium">Cambiar</span>
                    </div>
                </div>

                <div className="space-y-2 flex-1 w-full">
                    <label htmlFor="avatar" className="block text-sm font-medium text-zinc-400">
                        Foto de Perfil
                    </label>
                    <input
                        type="file"
                        id="avatar"
                        name="avatar"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="block w-full text-sm text-zinc-400
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-full file:border-0
                            file:text-sm file:font-semibold
                            file:bg-white/10 file:text-white
                            hover:file:bg-white/20
                            cursor-pointer"
                    />
                    <p className="text-xs text-zinc-500">
                        JPG, PNG o GIF. Máximo 2MB.
                    </p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Input
                    label="Nombre Completo"
                    name="full_name"
                    defaultValue={profile?.full_name || ''}
                    placeholder="Ej. Juan Pérez"
                />

                <Input
                    label="Nombre de Usuario"
                    name="username"
                    defaultValue={profile?.username || ''}
                    placeholder="Ej. juanperez"
                    required
                />
            </div>

            <Input
                label="Sitio Web"
                name="website"
                defaultValue={profile?.website || ''}
                placeholder="https://tunsitio.com"
            />

            <Input
                label="Ubicación"
                name="location"
                defaultValue={profile?.location || ''}
                placeholder="Ej. Buenos Aires, Argentina"
            />

            <Textarea
                label="Biografía"
                name="bio"
                defaultValue={profile?.bio || ''}
                placeholder="Cuéntanos un poco sobre ti..."
                className="min-h-[120px]"
            />

            {state?.error && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {state.error}
                </div>
            )}

            {state?.success && (
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                    {state.success}
                </div>
            )}

            <div className="flex items-center gap-4 pt-4">
                <Button type="submit" disabled={isPending}>
                    {isPending ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
                <Link href="/profile" className="text-sm text-zinc-400 hover:text-white">
                    Cancelar
                </Link>
            </div>
        </form>
    )
}
