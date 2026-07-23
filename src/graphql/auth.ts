import { builder } from './builder'
import { getProfile } from '@/src/domains/auth/data'
import type { Profile } from '@/src/core/types'

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
