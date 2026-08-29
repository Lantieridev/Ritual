import { builder } from './builder'
import { findProfile } from '@/src/domains/auth/service'
import { modifyProfile, assignUserRole } from '@/src/domains/auth/service'
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
        // Only the profile's own owner or an admin can see a role — anyone
        // else would let an anonymous caller enumerate which accounts are
        // moderador/admin by querying profile(id) across ids, a targeting
        // aid for social-engineering against privileged accounts.
        role: t.field({
            type: 'String',
            nullable: true,
            resolve: (profile, _args, context) =>
                context.userId === profile.id || context.role === 'admin' ? profile.role : null,
        }),
    }),
})

builder.queryField('me', (t) =>
    t.field({
        type: ProfileRef,
        nullable: true,
        description: 'El perfil del usuario autenticado, o null si no hay sesión.',
        resolve: () => findProfile(),
    })
)

builder.queryField('profile', (t) =>
    t.field({
        type: ProfileRef,
        nullable: true,
        args: {
            id: t.arg.id({ required: true }),
        },
        resolve: (_root, args) => findProfile(String(args.id)),
    })
)

// `avatarUrl` recibe una URL, no el archivo: subir la imagen necesita
// multipart/Upload scalar en Yoga, que no está configurado, así que el File
// lo sigue tomando una Server Action (src/domains/auth/avatar-actions.ts) que
// solo escribe en el bucket. La URL que devuelve vuelve por acá, de modo que
// la fila de `profiles` se escribe una sola vez, con texto y avatar juntos.
const ProfileUpdateInput = builder.inputType('ProfileUpdateInput', {
    fields: (t) => ({
        fullName: t.string(),
        username: t.string(),
        bio: t.string(),
        website: t.string(),
        location: t.string(),
        avatarUrl: t.string(),
    }),
})

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
                    avatar_url: args.input.avatarUrl ?? undefined,
                })
            ),
    })
)

builder.mutationField('assignRole', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            userId: t.arg.id({ required: true }),
            role: t.arg.string({ required: true }),
        },
        resolve: async (_root, args, context) => {
            if (context.role !== 'admin') {
                return toMutationResult({ error: 'No tenés permisos para realizar esta acción.' })
            }
            return toMutationResult(
                await assignUserRole(String(args.userId), args.role)
            )
        },
    })
)
