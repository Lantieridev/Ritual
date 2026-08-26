import { builder } from './builder'
import {
    listArtists,
    findArtistById,
    insertArtist,
    findOrCreateArtist,
    getWishlistArtistIds,
    toggleWishlist,
} from '@/src/domains/artists/service'
import { getArtistEvents } from '@/src/domains/artists/data'
import type { ArtistEvent, ArtistWithEvents } from '@/src/domains/artists/data'
import type { Artist } from '@/src/core/types'

const ArtistEventVenueRef = builder.objectRef<NonNullable<ArtistEvent['venues']>>('ArtistEventVenue')
ArtistEventVenueRef.implement({
    fields: (t) => ({
        name: t.exposeString('name'),
        city: t.exposeString('city', { nullable: true }),
    }),
})

const ArtistEventPhotoRef = builder.objectRef<ArtistEvent['event_photos'][number]>('ArtistEventPhoto')
ArtistEventPhotoRef.implement({
    fields: (t) => ({
        storagePath: t.exposeString('storage_path'),
        caption: t.exposeString('caption', { nullable: true }),
    }),
})

const ArtistEventAttendanceRef = builder.objectRef<ArtistEvent['attendance'][number]>(
    'ArtistEventAttendance'
)
ArtistEventAttendanceRef.implement({
    fields: (t) => ({
        status: t.exposeString('status'),
        rating: t.exposeInt('rating', { nullable: true }),
        review: t.exposeString('review', { nullable: true }),
    }),
})

const ArtistEventRef = builder.objectRef<ArtistEvent>('ArtistEvent')
ArtistEventRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        name: t.exposeString('name', { nullable: true }),
        date: t.exposeString('date'),
        venue: t.field({ type: ArtistEventVenueRef, nullable: true, resolve: (e) => e.venues }),
        photos: t.field({ type: [ArtistEventPhotoRef], resolve: (e) => e.event_photos ?? [] }),
        attendance: t.field({ type: [ArtistEventAttendanceRef], resolve: (e) => e.attendance ?? [] }),
    }),
})

export const ArtistRef = builder.objectRef<Artist | ArtistWithEvents>('Artist')

ArtistRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        name: t.exposeString('name'),
        genre: t.exposeString('genre', { nullable: true }),
        imageUrl: t.exposeString('image_url', { nullable: true }),
        spotifyId: t.exposeString('spotify_id', { nullable: true }),
        status: t.exposeString('status', { nullable: true }),
        // `getArtists()` no trae la relación y `getArtistById()` sí, así que
        // el campo la carga bajo demanda solo cuando no vino ya resuelta —
        // para que pedir `events` desde la query de listado devuelva el
        // historial real y no un array vacío silencioso.
        events: t.field({
            type: [ArtistEventRef],
            resolve: (artist, _args, context) =>
                'events' in artist ? artist.events : context.artistEventsLoader.load(artist.id),
        }),
    }),
})

builder.queryField('artists', (t) =>
    t.field({
        type: [ArtistRef],
        resolve: () => listArtists(),
    })
)

builder.queryField('artist', (t) =>
    t.field({
        type: ArtistRef,
        nullable: true,
        args: {
            id: t.arg.id({ required: true }),
        },
        resolve: (_root, args) => findArtistById(String(args.id)),
    })
)

builder.queryField('wishlistArtistIds', (t) =>
    t.field({
        type: ['ID'],
        description: 'IDs de los artistas que el usuario actual sigue. Vacío si no hay sesión.',
        resolve: () => getWishlistArtistIds(),
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

// El estado resultante viaja en el payload en vez de inferirse en el cliente:
// el toggle es optimista en la UI y necesita el valor real para reconciliar.
const ToggleWishlistResultRef = builder.objectRef<{ inWishlist: boolean; error?: string }>(
    'ToggleWishlistResult'
)
ToggleWishlistResultRef.implement({
    fields: (t) => ({
        inWishlist: t.exposeBoolean('inWishlist'),
        error: t.exposeString('error', { nullable: true }),
    }),
})

builder.mutationField('toggleWishlist', (t) =>
    t.field({
        type: ToggleWishlistResultRef,
        description: 'Agrega o quita un artista de la wishlist del usuario actual.',
        args: {
            artistId: t.arg.id({ required: true }),
        },
        resolve: async (_root, args) => {
            const { inWishlist, error } = await toggleWishlist(String(args.artistId))
            return { inWishlist, error }
        },
    })
)
