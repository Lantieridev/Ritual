import { builder } from './builder'
import { getArtists, getArtistById } from '@/src/domains/artists/data'
import { insertArtist, findOrCreateArtist } from '@/src/domains/artists/actions'

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

const ArtistCreateInput = builder.inputType('ArtistCreateInput', {
    fields: (t) => ({
        name: t.string({ required: true }),
        genre: t.string(),
    }),
})

const CreateArtistResultRef = builder.objectRef<{ id?: string; existingId?: string; error?: string }>(
    'CreateArtistResult'
)
CreateArtistResultRef.implement({
    fields: (t) => ({
        id: t.exposeID('id', { nullable: true }),
        existingId: t.exposeID('existingId', { nullable: true }),
        error: t.exposeString('error', { nullable: true }),
    }),
})

builder.mutationField('createArtist', (t) =>
    t.field({
        type: CreateArtistResultRef,
        args: {
            input: t.arg({ type: ArtistCreateInput, required: true }),
        },
        resolve: (_root, args) =>
            insertArtist({
                name: args.input.name,
                genre: args.input.genre ?? undefined,
            }),
    })
)

const FindOrCreateArtistResultRef = builder.objectRef<{ id?: string; error?: string }>('FindOrCreateArtistResult')
FindOrCreateArtistResultRef.implement({
    fields: (t) => ({
        id: t.exposeID('id', { nullable: true }),
        error: t.exposeString('error', { nullable: true }),
    }),
})

builder.mutationField('findOrCreateArtist', (t) =>
    t.field({
        type: FindOrCreateArtistResultRef,
        description: 'Busca un artista por nombre o lo crea si no existe — para autocompletado inline.',
        args: {
            name: t.arg.string({ required: true }),
            genre: t.arg.string(),
        },
        resolve: (_root, args) => findOrCreateArtist(args.name, args.genre ?? undefined),
    })
)
