import { builder } from './builder'
import { getEvents, getEventsWithAttendance, getEventById } from '@/src/domains/events/data'
import type { EventWithAttendance } from '@/src/domains/events/data'
import { getAttendanceForEvent } from '@/src/domains/events/attendance-data'
import { getEventPhotos } from '@/src/domains/events/photo-actions'
import type { EventWithRelations, LineupRow } from '@/src/core/types'

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
// los tres (getEvents/getEventById devuelven el primero, sin la propiedad
// attendance) — Pothos solo expone los campos declarados abajo, así que un
// Event sin attendance real simplemente no la tiene poblada.
export const EventRef = builder.objectRef<EventWithAttendance>('Event')
EventRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        name: t.exposeString('name', { nullable: true }),
        date: t.exposeString('date'),
        status: t.exposeString('status', { nullable: true }),
        createdAt: t.exposeString('created_at', { nullable: true }),
        venue: t.field({ type: EventVenueSummaryRef, nullable: true, resolve: (e) => e.venues }),
        lineups: t.field({ type: [LineupRowRef], resolve: (e) => e.lineups ?? [] }),
        // Ya viene resuelta en bloque por getEventsWithAttendance (un solo
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
            resolve: (e) => getAttendanceForEvent(e.id),
        }),
        photos: t.field({
            type: [EventPhotoRef],
            resolve: (e) =>
                getEventPhotos(e.id).then((photos) =>
                    photos.map((p) => ({ id: p.id, caption: p.caption, createdAt: p.created_at, url: p.url }))
                ),
        }),
    }),
})

builder.queryField('events', (t) =>
    t.field({
        type: [EventRef],
        description: 'Catálogo compartido de eventos, sin attendance.',
        resolve: () => getEvents(),
    })
)

builder.queryField('eventsWithAttendance', (t) =>
    t.field({
        type: [EventRef],
        description: 'Eventos con la attendance del usuario actual ya incluida (batch, sin N+1).',
        resolve: () => getEventsWithAttendance(),
    })
)

builder.queryField('event', (t) =>
    t.field({
        type: EventRef,
        nullable: true,
        args: {
            id: t.arg.id({ required: true }),
        },
        resolve: (_root, args) => getEventById(String(args.id)),
    })
)
