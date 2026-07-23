import { builder } from './builder'
import { getProfile } from '@/src/domains/auth/data'
import { modifyProfile } from '@/src/domains/auth/actions'
import type { Profile } from '@/src/core/types'
import { MutationResultRef, toMutationResult } from './shared'

export const ProfileRef = builder.objectRef<Profile>('Profile')

ProfileRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        username: t.exposeString('username', { nullable: true }),
        fullName: t.exposeString('full_name', { nullable: true }),
        avatarUrl: t.exposeString('avatar_url', { nullable: true }),
        website: t.exposeString('website', { nullable: true }),
        bio: t.exposeString('bio', { nullable: true }),
        location: t.exposeString('location', { nullable: true }),
        updatedAt: t.exposeString('updated_at', { nullable: true }),
    }),
})

builder.queryField('me', (t) =>
    t.field({
        type: ProfileRef,
        nullable: true,
        description: 'El perfil del usuario autenticado, o null si no hay sesión.',
        resolve: () => getProfile(),
    })
)

builder.queryField('profile', (t) =>
    t.field({
        type: ProfileRef,
        nullable: true,
        args: {
            id: t.arg.id({ required: true }),
        },
        resolve: (_root, args) => getProfile(String(args.id)),
    })
)

const ProfileUpdateInput = builder.inputType('ProfileUpdateInput', {
    fields: (t) => ({
        fullName: t.string(),
        username: t.string(),
        bio: t.string(),
        website: t.string(),
        location: t.string(),
    }),
})

// Sin campo de avatar a propósito: la subida de imagen todavía no está
// migrada a GraphQL (requiere soporte de multipart/Upload scalar en Yoga,
// trabajo aparte) — ver el comentario en modifyProfile(), en
// src/domains/auth/actions.ts. Cambiar el avatar sigue siendo solo desde
// el formulario web de /profile/editar hasta que eso se resuelva.
builder.mutationField('updateProfile', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            input: t.arg({ type: ProfileUpdateInput, required: true }),
        },
        resolve: async (_root, args) =>
            toMutationResult(
                await modifyProfile({
                    full_name: args.input.fullName ?? undefined,
                    username: args.input.username ?? undefined,
                    bio: args.input.bio ?? undefined,
                    website: args.input.website ?? undefined,
                    location: args.input.location ?? undefined,
                })
            ),
    })
)
