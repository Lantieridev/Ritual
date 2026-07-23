import { builder } from './builder'
import { getArtists, getArtistById } from '@/src/domains/artists/data'

export const ArtistRef = builder.objectRef<{
    id: string
    name: string
    genre?: string | null
    image_url?: string | null
    spotify_id?: string | null
}>('Artist')

ArtistRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        name: t.exposeString('name'),
        genre: t.exposeString('genre', { nullable: true }),
        imageUrl: t.exposeString('image_url', { nullable: true }),
        spotifyId: t.exposeString('spotify_id', { nullable: true }),
    }),
})

builder.queryField('artists', (t) =>
    t.field({
        type: [ArtistRef],
        resolve: () => getArtists(),
    })
)

builder.queryField('artist', (t) =>
    t.field({
        type: ArtistRef,
        nullable: true,
        args: {
            id: t.arg.id({ required: true }),
        },
        resolve: (_root, args) => getArtistById(String(args.id)),
    })
)
