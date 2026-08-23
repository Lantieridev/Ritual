import { builder } from './builder'
import {
    listFestivals,
    findFestivalById,
    insertFestival,
    removeFestival,
    saveFestivalAttendance,
    linkEventToFestival,
} from '@/src/domains/festivals/service'
import type { Festival } from '@/src/domains/festivals/service'
import { MutationResultRef, toMutationResult } from './shared'
import { AttendanceStatusEnum } from './events'

type FestivalVenueSummary = Festival['venues']
type FestivalEventEntry = Festival['festival_events'][number]
type FestivalAttendanceEntry = Festival['festival_attendance'][number]
type FestivalLineupEntry = FestivalEventEntry['events']['lineups'][number]

const FestivalVenueSummaryRef = builder.objectRef<NonNullable<FestivalVenueSummary>>('FestivalVenueSummary')
FestivalVenueSummaryRef.implement({
    fields: (t) => ({
        name: t.exposeString('name'),
        city: t.exposeString('city', { nullable: true }),
    }),
})

const FestivalLineupArtistRef = builder.objectRef<FestivalLineupEntry['artists']>('FestivalLineupArtist')
FestivalLineupArtistRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        name: t.exposeString('name'),
    }),
})

const FestivalLineupEntryRef = builder.objectRef<FestivalLineupEntry>('FestivalLineupEntry')
FestivalLineupEntryRef.implement({
    fields: (t) => ({
        artist: t.field({ type: FestivalLineupArtistRef, resolve: (l) => l.artists }),
        // El detalle del festival ordena el lineup por horario y muestra el
        // escenario al lado del nombre — sin estos dos campos la grilla del
        // día queda sin horarios y en orden arbitrario.
        stage: t.exposeString('stage', { nullable: true }),
        startTime: t.exposeString('start_time', { nullable: true }),
    }),
})

const FestivalDayEventRef = builder.objectRef<FestivalEventEntry['events']>('FestivalDayEvent')
FestivalDayEventRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        name: t.exposeString('name', { nullable: true }),
        date: t.exposeString('date'),
        lineups: t.field({ type: [FestivalLineupEntryRef], resolve: (e) => e.lineups }),
    }),
})

const FestivalEventEntryRef = builder.objectRef<FestivalEventEntry>('FestivalEventEntry')
FestivalEventEntryRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        dayLabel: t.exposeString('day_label', { nullable: true }),
        event: t.field({ type: FestivalDayEventRef, resolve: (fe) => fe.events }),
    }),
})

const FestivalAttendanceEntryRef = builder.objectRef<FestivalAttendanceEntry>('FestivalAttendanceEntry')
FestivalAttendanceEntryRef.implement({
    fields: (t) => ({
        status: t.exposeString('status'),
        rating: t.exposeInt('rating', { nullable: true }),
        review: t.exposeString('review', { nullable: true }),
    }),
})

export const FestivalRef = builder.objectRef<Festival>('Festival')
FestivalRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        name: t.exposeString('name'),
        edition: t.exposeString('edition', { nullable: true }),
        startDate: t.exposeString('start_date'),
        endDate: t.exposeString('end_date', { nullable: true }),
        venueId: t.exposeID('venue_id', { nullable: true }),
        city: t.exposeString('city', { nullable: true }),
        country: t.exposeString('country', { nullable: true }),
        website: t.exposeString('website', { nullable: true }),
        posterUrl: t.exposeString('poster_url', { nullable: true }),
        notes: t.exposeString('notes', { nullable: true }),
        createdAt: t.exposeString('created_at'),
        venue: t.field({ type: FestivalVenueSummaryRef, nullable: true, resolve: (f) => f.venues }),
        festivalEvents: t.field({ type: [FestivalEventEntryRef], resolve: (f) => f.festival_events }),
        festivalAttendance: t.field({ type: [FestivalAttendanceEntryRef], resolve: (f) => f.festival_attendance }),
    }),
})

builder.queryField('festivals', (t) =>
    t.field({
        type: [FestivalRef],
        resolve: () => listFestivals(),
    })
)

builder.queryField('festival', (t) =>
    t.field({
        type: FestivalRef,
        nullable: true,
        args: {
            id: t.arg.id({ required: true }),
        },
        resolve: (_root, args) => findFestivalById(String(args.id)),
    })
)

const FestivalCreateInput = builder.inputType('FestivalCreateInput', {
    fields: (t) => ({
        name: t.string({ required: true }),
        edition: t.string(),
        startDate: t.string({ required: true }),
        endDate: t.string(),
        city: t.string(),
        country: t.string(),
        website: t.string(),
        notes: t.string(),
    }),
})

const CreateFestivalResultRef = builder.objectRef<{ id?: string; error?: string }>('CreateFestivalResult')
CreateFestivalResultRef.implement({
    fields: (t) => ({
        id: t.exposeID('id', { nullable: true }),
        error: t.exposeString('error', { nullable: true }),
    }),
})

builder.mutationField('createFestival', (t) =>
    t.field({
        type: CreateFestivalResultRef,
        args: {
            input: t.arg({ type: FestivalCreateInput, required: true }),
        },
        resolve: (_root, args) =>
            insertFestival({
                name: args.input.name,
                edition: args.input.edition ?? undefined,
                start_date: args.input.startDate,
                end_date: args.input.endDate ?? undefined,
                city: args.input.city ?? undefined,
                country: args.input.country ?? undefined,
                website: args.input.website ?? undefined,
                notes: args.input.notes ?? undefined,
            }),
    })
)

builder.mutationField('deleteFestival', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            id: t.arg.id({ required: true }),
        },
        resolve: async (_root, args) => toMutationResult(await removeFestival(String(args.id))),
    })
)

builder.mutationField('saveFestivalAttendance', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            festivalId: t.arg.id({ required: true }),
            status: t.arg({ type: AttendanceStatusEnum, required: true }),
            rating: t.arg.int(),
            review: t.arg.string(),
        },
        resolve: async (_root, args) =>
            toMutationResult(
                await saveFestivalAttendance(
                    String(args.festivalId),
                    args.status,
                    args.rating ?? undefined,
                    args.review ?? undefined
                )
            ),
    })
)

builder.mutationField('linkEventToFestival', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            festivalId: t.arg.id({ required: true }),
            eventId: t.arg.id({ required: true }),
            dayLabel: t.arg.string(),
        },
        resolve: async (_root, args) =>
            toMutationResult(
                await linkEventToFestival(String(args.festivalId), String(args.eventId), args.dayLabel ?? undefined)
            ),
    })
)
