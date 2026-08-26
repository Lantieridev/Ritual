import { builder } from './builder'
import { listExpenses, findExpenseById, summarizeExpenses } from '@/src/domains/expenses/service'
import type { ExpenseSummary } from '@/src/domains/expenses/service'
import { insertExpense, modifyExpense, removeExpense } from '@/src/domains/expenses/service'
import { MutationResultRef, toMutationResult } from './shared'
import { findEventById } from '@/src/domains/events/service'
import { estimateSpendForEvent, listExpensesForEvent } from '@/src/domains/expenses/service'
import type { VenueArtistSpendEstimate } from '@/src/domains/expenses/service'

export const ExpenseRef = builder.objectRef<{
    id: string
    user_id: string
    amount: number
    category: string
    note?: string | null
    event_id?: string | null
    date: string
    created_at?: string
}>('Expense')

ExpenseRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        userId: t.exposeID('user_id'),
        amount: t.exposeFloat('amount'),
        category: t.exposeString('category'),
        note: t.exposeString('note', { nullable: true }),
        eventId: t.exposeID('event_id', { nullable: true }),
        date: t.exposeString('date'),
        createdAt: t.exposeString('created_at', { nullable: true }),
    }),
})

// byCategory/byYear son Record<string, number> arbitrarios (una clave por
// categoría o por año presente en los gastos del usuario) — se exponen con
// el escalar JSON definido en builder.ts en vez de inventar un tipo GraphQL
// distinto por cada categoría/año posible.
const ExpenseSummaryRef = builder.objectRef<ExpenseSummary>('ExpenseSummary')
ExpenseSummaryRef.implement({
    fields: (t) => ({
        total: t.exposeFloat('total'),
        count: t.exposeInt('count'),
        byCategory: t.field({ type: 'JSON', resolve: (s) => s.byCategory }),
        byYear: t.field({ type: 'JSON', resolve: (s) => s.byYear }),
    }),
})

builder.queryField('expenses', (t) =>
    t.field({
        type: [ExpenseRef],
        args: {
            eventId: t.arg.id({ required: false }),
        },
        resolve: async (_root, args, ctx) => {
            if (args.eventId) {
                return listExpensesForEvent(String(args.eventId), ctx.userId)
            }
            return listExpenses(ctx.userId)
        }
    })
)

builder.queryField('expense', (t) =>
    t.field({
        type: ExpenseRef,
        nullable: true,
        args: {
            id: t.arg.id({ required: true }),
        },
        resolve: (_root, args, ctx) => findExpenseById(String(args.id), ctx.userId),
    })
)

builder.queryField('expensesSummary', (t) =>
    t.field({
        type: ExpenseSummaryRef,
        resolve: (_root, _args, ctx) => summarizeExpenses(ctx.userId),
    })
)

const ExpenseCreateInput = builder.inputType('ExpenseCreateInput', {
    fields: (t) => ({
        amount: t.float({ required: true }),
        category: t.string({ required: true }),
        note: t.string(),
        eventId: t.id(),
        date: t.string({ required: true }),
    }),
})

const ExpenseUpdateInput = builder.inputType('ExpenseUpdateInput', {
    fields: (t) => ({
        amount: t.float(),
        category: t.string(),
        note: t.string(),
        eventId: t.id(),
        date: t.string(),
    }),
})

const CreateExpenseResultRef = builder.objectRef<{ id?: string; error?: string }>('CreateExpenseResult')
CreateExpenseResultRef.implement({
    fields: (t) => ({
        id: t.exposeID('id', { nullable: true }),
        error: t.exposeString('error', { nullable: true }),
    }),
})

builder.mutationField('createExpense', (t) =>
    t.field({
        type: CreateExpenseResultRef,
        args: {
            input: t.arg({ type: ExpenseCreateInput, required: true }),
        },
        resolve: (_root, args) =>
            insertExpense({
                amount: args.input.amount,
                category: args.input.category,
                note: args.input.note ?? undefined,
                event_id: args.input.eventId ? String(args.input.eventId) : undefined,
                date: args.input.date,
            }),
    })
)

builder.mutationField('updateExpense', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            id: t.arg.id({ required: true }),
            input: t.arg({ type: ExpenseUpdateInput, required: true }),
        },
        resolve: async (_root, args) =>
            toMutationResult(
                await modifyExpense(String(args.id), {
                    amount: args.input.amount ?? undefined,
                    category: args.input.category ?? undefined,
                    note: args.input.note ?? undefined,
                    event_id: args.input.eventId ? String(args.input.eventId) : undefined,
                    date: args.input.date ?? undefined,
                })
            ),
    })
)

builder.mutationField('deleteExpense', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            id: t.arg.id({ required: true }),
        },
        resolve: async (_root, args) => toMutationResult(await removeExpense(String(args.id))),
    })
)


const VenueArtistSpendEstimateRef = builder.objectRef<VenueArtistSpendEstimate>('VenueArtistSpendEstimate')
VenueArtistSpendEstimateRef.implement({
    fields: (t) => ({
        averageTotal: t.exposeFloat('averageTotal'),
        eventsConsidered: t.exposeInt('eventsConsidered'),
    }),
})

builder.queryField('estimateSpendForEvent', (t) =>
    t.field({
        type: VenueArtistSpendEstimateRef,
        nullable: true,
        args: { eventId: t.arg.id({ required: true }) },
        resolve: async (_root, args, ctx) => {
            const event = await findEventById(String(args.eventId))
            if (!event) return null
            return estimateSpendForEvent(event, ctx.userId)
        }
    })
)
