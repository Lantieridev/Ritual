import { builder } from './builder'
import { resolveOffsetConnection } from '@pothos/plugin-relay'
import { deleteEventPhoto } from '@/src/domains/events/photo-actions'
import {
    insertEvent,
    modifyEvent,
    removeEvent,
    addExternalEvent,
    listEvents,
    listEventsWithAttendance,
    findEventById,
} from '@/src/domains/events/service'
import type { EventWithAttendance } from '@/src/domains/events/service'
import { getOrCreateAttendance, setAttendanceStatus, saveMemory } from '@/src/domains/events/attendance-actions'
import type { EventWithRelations, LineupRow } from '@/src/core/types'
import type { FutureEvent } from '@/src/core/types'
import { MutationResultRef, toMutationResult } from './shared'

export const AttendanceStatusEnum = builder.enumType('AttendanceStatus', {
    values: ['interested', 'going', 'went'] as const,
})

const EventVenueSummaryRef = builder.objectRef<NonNullable<EventWithRelations['venues']>>('EventVenueSummary')
EventVenueSummaryRef.implement({
    fields: (t) => ({
        name: t.exposeString('name'),
        city: t.exposeString('city', { nullable: true }),
        country: t.exposeString('country', { nullable: true }),
    }),
})

const LineupArtistRef = builder.objectRef<LineupRow['artists']>('LineupArtist')
LineupArtistRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        name: t.exposeString('name'),
        genre: t.exposeString('genre', { nullable: true }),
    }),
})

const LineupRowRef = builder.objectRef<LineupRow>('LineupRow')
LineupRowRef.implement({
    fields: (t) => ({
        artist: t.field({ type: LineupArtistRef, resolve: (l) => l.artists }),
        stage: t.exposeString('stage', { nullable: true }),
        isHeadliner: t.exposeBoolean('is_headliner', { nullable: true }),
    }),
})

const AttendanceRowRef = builder.objectRef<NonNullable<EventWithAttendance['attendance']>[number]>('AttendanceRow')
AttendanceRowRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        status: t.field({ type: AttendanceStatusEnum, resolve: (a) => a.status as 'interested' | 'going' | 'went' }),
        rating: t.exposeInt('rating', { nullable: true }),
        review: t.exposeString('review', { nullable: true }),
    }),
})

const EventAttendanceRef = builder.objectRef<{
    id: string
    status: 'interested' | 'going' | 'went'
    rating: number | null
    review: string | null
    notes: string | null
}>('EventAttendance')
EventAttendanceRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        status: t.field({ type: AttendanceStatusEnum, resolve: (a) => a.status }),
        rating: t.exposeInt('rating', { nullable: true }),
        review: t.exposeString('review', { nullable: true }),
        notes: t.exposeString('notes', { nullable: true }),
    }),
})

const EventPhotoRef = builder.objectRef<{
    id: string
    caption: string | null
    createdAt: string
    url: string
}>('EventPhoto')
EventPhotoRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        caption: t.exposeString('caption', { nullable: true }),
        createdAt: t.exposeString('createdAt'),
        url: t.exposeString('url'),
    }),
})

// EventWithAttendance en vez de EventWithRelations: es el tipo más ancho de
// los tres (listEvents/findEventById devuelven el primero, sin la propiedad
// attendance) — Pothos solo expone los campos declarados abajo, así que un
// Event sin attendance real simplemente no la tiene poblada.
export const EventRef = builder.objectRef<EventWithAttendance>('Event')
EventRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        name: t.exposeString('name', { nullable: true }),
        date: t.exposeString('date'),
        status: t.exposeString('status', { nullable: true }),
        ticketUrl: t.exposeString('ticket_url', { nullable: true }),
        createdAt: t.exposeString('created_at', { nullable: true }),
        venue: t.field({ type: EventVenueSummaryRef, nullable: true, resolve: (e) => e.venues }),
        lineups: t.field({ type: [LineupRowRef], resolve: (e) => e.lineups ?? [] }),
        // Ya viene resuelta en bloque por listEventsWithAttendance (un solo
        // join, no una query por evento) — nunca dispara una consulta nueva
        // acá, por eso es segura de usar sobre una lista completa sin N+1.
        attendance: t.field({ type: [AttendanceRowRef], resolve: (e) => e.attendance ?? [] }),
        // A diferencia de `attendance`, estos dos SÍ hacen una consulta por
        // evento (getAttendanceForEvent/getEventPhotos) — están pensados
        // para pedirse sobre un `event(id)` puntual (la ficha de un show),
        // no sobre una lista completa; pedirlos dentro de `events`/
        // `eventsWithAttendance` para muchos eventos a la vez sería N+1.
        // Si en algún momento hace falta ese caso, la solución es un
        // DataLoader que batchee por event_id, no resolver así como está.
        myAttendance: t.field({
            type: EventAttendanceRef,
            nullable: true,
            resolve: (e, args, context) => context.attendanceLoader.load(e.id),
        }),
        photos: t.field({
            type: [EventPhotoRef],
            resolve: (e, args, context) =>
                context.photosLoader.load(e.id).then((photos) =>
                    photos.map((p) => ({ id: p.id, caption: p.caption, createdAt: p.created_at, url: p.url }))
                ),
        }),
    }),
})

builder.queryField('events', (t) =>
    t.connection({
        type: EventRef,
        description: 'Catálogo compartido de eventos, sin attendance.',
        resolve: (_root, args) =>
            resolveOffsetConnection({ args }, ({ limit, offset }) =>
                listEvents({ limit, offset })
            ),
    })
)

builder.queryField('eventsWithAttendance', (t) =>
    t.connection({
        type: EventRef,
        description: 'Eventos con la attendance del usuario actual ya incluida (batch, sin N+1).',
        resolve: (_root, args) =>
            resolveOffsetConnection({ args }, ({ limit, offset }) =>
                listEventsWithAttendance({ limit, offset })
            ),
    })
)

builder.queryField('event', (t) =>
    t.field({
        type: EventRef,
        nullable: true,
        args: {
            id: t.arg.id({ required: true }),
        },
        resolve: (_root, args) => findEventById(String(args.id)),
    })
)

const EventCreateInput = builder.inputType('EventCreateInput', {
    fields: (t) => ({
        name: t.string({ required: true }),
        date: t.string({ required: true }),
        venueId: t.id({ required: true }),
        artistIds: t.idList(),
        ticketUrl: t.string(),
    }),
})

const EventUpdateInput = builder.inputType('EventUpdateInput', {
    fields: (t) => ({
        name: t.string(),
        date: t.string(),
        venueId: t.id(),
        artistIds: t.idList(),
        ticketUrl: t.string(),
    }),
})

const CreateEventResultRef = builder.objectRef<{ id?: string; error?: string }>('CreateEventResult')
CreateEventResultRef.implement({
    fields: (t) => ({
        id: t.exposeID('id', { nullable: true }),
        error: t.exposeString('error', { nullable: true }),
    }),
})

builder.mutationField('createEvent', (t) =>
    t.field({
        type: CreateEventResultRef,
        args: {
            input: t.arg({ type: EventCreateInput, required: true }),
        },
        resolve: (_root, args) =>
            insertEvent({
                name: args.input.name,
                date: args.input.date,
                venue_id: String(args.input.venueId),
                artist_ids: args.input.artistIds?.map(String),
                ticket_url: args.input.ticketUrl ?? undefined,
            }),
    })
)

builder.mutationField('updateEvent', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            id: t.arg.id({ required: true }),
            input: t.arg({ type: EventUpdateInput, required: true }),
        },
        resolve: async (_root, args) =>
            toMutationResult(
                await modifyEvent(String(args.id), {
                    name: args.input.name ?? undefined,
                    date: args.input.date ?? undefined,
                    venue_id: args.input.venueId ? String(args.input.venueId) : undefined,
                    artist_ids: args.input.artistIds?.map(String),
                    // `?? undefined` y no truthiness: mandar '' es cómo se
                    // borra el link de entradas, y `|| undefined` lo leería
                    // como "no lo toques", dejando el link viejo pegado.
                    ticket_url: args.input.ticketUrl ?? undefined,
                })
            ),
    })
)

builder.mutationField('deleteEvent', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            id: t.arg.id({ required: true }),
        },
        resolve: async (_root, args) => toMutationResult(await removeEvent(String(args.id))),
    })
)

const AddExternalEventVenueInput = builder.inputType('AddExternalEventVenueInput', {
    fields: (t) => ({
        name: t.string({ required: true }),
        city: t.string(),
        country: t.string(),
    }),
})

// Solo los campos que addExternalEvent() efectivamente lee (title, datetime,
// venue, el primer artista del lineup) — no todo el shape de FutureEvent
// (id/url/image/priceRange/genre/status), que sirve para MOSTRAR resultados
// de búsqueda pero nunca se usa al importar el show elegido.
const AddExternalEventInput = builder.inputType('AddExternalEventInput', {
    fields: (t) => ({
        title: t.string(),
        datetime: t.string({ required: true }),
        venue: t.field({ type: AddExternalEventVenueInput, required: true }),
        lineup: t.stringList(),
    }),
})

const AddExternalEventResultRef = builder.objectRef<{ eventId?: string; error?: string }>('AddExternalEventResult')
AddExternalEventResultRef.implement({
    fields: (t) => ({
        eventId: t.exposeID('eventId', { nullable: true }),
        error: t.exposeString('error', { nullable: true }),
    }),
})

builder.mutationField('addExternalEvent', (t) =>
    t.field({
        type: AddExternalEventResultRef,
        description: 'Crea un recital a partir de un resultado externo (Ticketmaster/Setlist.fm), buscando o creando sede y artista.',
        args: {
            input: t.arg({ type: AddExternalEventInput, required: true }),
            artistNameForLineup: t.arg.string(),
            notes: t.arg.string(),
        },
        resolve: (_root, args) => {
            const futureEvent: FutureEvent = {
                id: '',
                title: args.input.title ?? '',
                datetime: args.input.datetime,
                venue: {
                    name: args.input.venue.name,
                    city: args.input.venue.city ?? undefined,
                    country: args.input.venue.country ?? undefined,
                },
                lineup: args.input.lineup ?? [],
            }
            return addExternalEvent(futureEvent, args.artistNameForLineup ?? undefined, args.notes ?? undefined)
        },
    })
)

builder.mutationField('getOrCreateAttendance', (t) =>
    t.field({
        type: EventAttendanceRef,
        nullable: true,
        description: 'Obtiene la attendance del evento para el usuario actual, creándola en "interested" si no existe.',
        args: {
            eventId: t.arg.id({ required: true }),
        },
        resolve: async (_root, args) => {
            const attendance = await getOrCreateAttendance(String(args.eventId))
            if (!attendance) return null
            return { ...attendance, rating: null, review: null, notes: null }
        },
    })
)

builder.mutationField('setAttendanceStatus', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            eventId: t.arg.id({ required: true }),
            status: t.arg({ type: AttendanceStatusEnum, required: true }),
        },
        resolve: async (_root, args) =>
            toMutationResult(await setAttendanceStatus(String(args.eventId), args.status)),
    })
)

// Sin mutation de subida de fotos a propósito: uploadEventPhoto() recibe un
// File por FormData, mismo caso que el avatar de perfil (ver auth.ts) —
// necesita soporte de multipart/Upload scalar en Yoga, que es trabajo
// aparte. Subir fotos sigue siendo solo desde el formulario web por ahora.
builder.mutationField('deleteEventPhoto', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            photoId: t.arg.id({ required: true }),
            eventId: t.arg.id({ required: true }),
        },
        resolve: async (_root, args) =>
            toMutationResult(await deleteEventPhoto(String(args.photoId), String(args.eventId))),
    })
)

builder.mutationField('saveMemory', (t) =>
    t.field({
        type: MutationResultRef,
        description: 'Guarda o actualiza rating, reseña y notas de un evento.',
        args: {
            eventId: t.arg.id({ required: true }),
            rating: t.arg.int(),
            review: t.arg.string(),
            notes: t.arg.string(),
        },
        resolve: async (_root, args) =>
            toMutationResult(
                await saveMemory(String(args.eventId), {
                    rating: args.rating ?? undefined,
                    review: args.review ?? undefined,
                    notes: args.notes ?? undefined,
                })
            ),
    })
)
