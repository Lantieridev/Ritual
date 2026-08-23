'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, gql } from 'urql'
import { unwrapMutation } from '@/src/graphql/mutation-result'
import { uploadAvatar } from '@/src/domains/auth/avatar-actions'
import { Button } from '@/src/core/components/ui/Button'
import { Input } from '@/src/core/components/ui/Input'
import { Textarea } from '@/src/core/components/ui/Textarea'
import { Profile } from '@/src/core/types'
import Link from 'next/link'

interface ProfileFormProps {
    user: { id: string, email?: string }
    profile: Profile | null
}

const UpdateProfileMutation = gql`
  mutation UpdateProfile($input: ProfileUpdateInput!) {
    updateProfile(input: $input) { error }
  }
`

/**
 * El texto del perfil se guarda por GraphQL; la imagen del avatar sigue
 * pasando por una Server Action (uploadAvatar) porque es un File que viaja en
 * un FormData, y el schema no tiene scalar Upload configurado.
 *
 * El orden importa: primero el archivo al bucket, después un único upsert con
 * la URL resultante más los campos de texto. Al revés quedarían dos
 * escrituras a `profiles`, y un fallo en la segunda dejaría el perfil a
 * medias. Si la subida falla, no se guarda nada y el usuario ve el error.
 */
export function ProfileForm({ user, profile }: ProfileFormProps) {
    const router = useRouter()
    const [, updateProfile] = useMutation(UpdateProfileMutation)
    const [previewUrl, setPreviewUrl] = useState<string | null>(profile?.avatar_url || null)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [isPending, setIsPending] = useState(false)

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const url = URL.createObjectURL(file)
            setPreviewUrl(url)
        }
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setError(null)
        setSuccess(null)
        setIsPending(true)

        const form = e.currentTarget
        const avatarInput = form.elements.namedItem('avatar') as HTMLInputElement
        const avatarFile = avatarInput?.files?.[0]

        let avatarUrl: string | undefined
        if (avatarFile && avatarFile.size > 0) {
            const formData = new FormData()
            formData.append('avatar', avatarFile)
            const uploaded = await uploadAvatar(formData)
            if (uploaded.error || !uploaded.avatarUrl) {
                setError(uploaded.error ?? 'No se pudo subir la imagen.')
                setIsPending(false)
                return
            }
            avatarUrl = uploaded.avatarUrl
        }

        const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement).value

        const result = unwrapMutation(
            await updateProfile({
                input: {
                    fullName: value('full_name'),
                    username: value('username'),
                    bio: value('bio'),
                    website: value('website'),
                    location: value('location'),
                    // Solo cuando hubo subida: mandar la URL vieja no cambiaría
                    // nada, pero omitir la clave es lo que garantiza que el
                    // upsert no toque la columna del avatar.
                    avatarUrl,
                },
            }),
            'updateProfile',
            'No se pudo actualizar el perfil.'
        )

        if (result.error) {
            setError(result.error)
            setIsPending(false)
            return
        }

        setSuccess('Perfil actualizado correctamente.')
        setIsPending(false)
        router.refresh()
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <div className="w-32 h-32 overflow-hidden bg-ritual-surface border-2 border-ritual-red shrink-0 relative group">
                    {previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- preview de un File local (blob: URL), next/image no soporta ese esquema
                        <img
                            src={previewUrl}
                            alt="Avatar Preview"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center font-display text-4xl text-ritual-red-hover select-none">
                            {(profile?.full_name?.[0] || user.email?.[0] || '?').toUpperCase()}
                        </div>
                    )}

                    {/* Overlay for upload hint */}
                    <div className="absolute inset-0 bg-ritual-bg/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <span className="font-label text-[10px] uppercase tracking-[0.1em] text-ritual-bone">Cambiar</span>
                    </div>
                </div>

                <div className="space-y-2 flex-1 w-full">
                    <label htmlFor="avatar" className="block font-label text-[10px] tracking-[0.1em] uppercase text-ritual-gray-text">
                        Foto de Perfil
                    </label>
                    <input
                        type="file"
                        id="avatar"
                        name="avatar"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="block w-full font-label text-xs text-ritual-gray-text
                            file:mr-4 file:py-2 file:px-4
                            file:border-0
                            file:font-label file:text-[10px] file:uppercase file:tracking-[0.1em]
                            file:bg-ritual-surface-high file:text-ritual-bone
                            hover:file:bg-ritual-border-2
                            cursor-pointer"
                    />
                    <p className="font-label text-[10px] text-ritual-gray-text">
                        JPG, PNG o GIF. Máximo 2MB.
                    </p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Input
                    label="Nombre Completo"
                    id="full_name"
                    name="full_name"
                    defaultValue={profile?.full_name || ''}
                    placeholder="Ej. Juan Pérez"
                />

                <Input
                    label="Nombre de Usuario"
                    id="username"
                    name="username"
                    defaultValue={profile?.username || ''}
                    placeholder="Ej. juanperez"
                    required
                />
            </div>

            <Input
                label="Sitio Web"
                id="website"
                name="website"
                defaultValue={profile?.website || ''}
                placeholder="https://tunsitio.com"
            />

            <Input
                label="Ubicación"
                id="location"
                name="location"
                defaultValue={profile?.location || ''}
                placeholder="Ej. Buenos Aires, Argentina"
            />

            <Textarea
                label="Biografía"
                id="bio"
                name="bio"
                defaultValue={profile?.bio || ''}
                placeholder="Cuéntanos un poco sobre ti..."
                className="min-h-[120px]"
            />

            {error && (
                <div role="alert" className="p-4 bg-ritual-red/10 border border-ritual-red/20 text-ritual-red-hover font-body text-sm">
                    {error}
                </div>
            )}

            {success && (
                <div role="status" className="p-4 bg-ritual-surface border border-ritual-border text-ritual-gray-light-3 font-body text-sm">
                    {success}
                </div>
            )}

            <div className="flex items-center gap-4 pt-4">
                <Button type="submit" disabled={isPending}>
                    {isPending ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
                <Link href="/profile" className="font-label text-xs text-ritual-gray-text hover:text-ritual-gray-text uppercase tracking-[0.1em]">
                    Cancelar
                </Link>
            </div>
        </form>
    )
}
