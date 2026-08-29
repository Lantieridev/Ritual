import { builder } from './builder'
import { listExpenses, findExpenseById, summarizeExpenses } from '@/src/domains/expenses/service'
import type { ExpenseSummary, ExpenseSplitUser } from '@/src/domains/expenses/service'
import { insertExpense, modifyExpense, removeExpense, addExpenseSplit, removeExpenseSplit } from '@/src/domains/expenses/service'
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

const ExpenseSplitUserRef = builder.objectRef<ExpenseSplitUser>('ExpenseSplitUser')
ExpenseSplitUserRef.implement({
    fields: (t) => ({
        userId: t.exposeID('user_id'),
        username: t.exposeString('username', { nullable: true }),
    }),
})

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
        // Issue #58 ("Crew") — con quién se comparte este gasto.
        splits: t.field({
            type: [ExpenseSplitUserRef],
            resolve: (expense, _args, context) => context.expenseSplitsLoader.load(expense.id),
        }),
        // Quién pagó, para el resumen de "quién le debe a quién" cuando el
        // gasto es compartido y el caller no es el dueño.
        ownerUsername: t.field({
            type: 'String',
            nullable: true,
            resolve: (expense, _args, context) => context.usernameByIdLoader.load(expense.user_id),
        }),
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

// Payload propio, no MutationResultRef: el cliente necesita el user_id real
// del tageado para poder sacarlo del split después sin esperar un refetch
// (ilike es case-insensitive, así que lo tipeado no siempre es el username
// real tal cual está guardado).
const AddExpenseSplitResultRef = builder.objectRef<{ error?: string; userId?: string; username?: string }>(
    'AddExpenseSplitResult'
)
AddExpenseSplitResultRef.implement({
    fields: (t) => ({
        success: t.boolean({ resolve: (r) => !r.error }),
        error: t.exposeString('error', { nullable: true }),
        userId: t.exposeID('userId', { nullable: true }),
        username: t.exposeString('username', { nullable: true }),
    }),
})

builder.mutationField('addExpenseSplit', (t) =>
    t.field({
        type: AddExpenseSplitResultRef,
        description: 'Comparte un gasto con otro usuario de Ritual, por username — issue #58.',
        args: {
            expenseId: t.arg.id({ required: true }),
            username: t.arg.string({ required: true }),
        },
        resolve: (_root, args) => addExpenseSplit(String(args.expenseId), args.username),
    })
)

builder.mutationField('removeExpenseSplit', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            expenseId: t.arg.id({ required: true }),
            userId: t.arg.id({ required: true }),
        },
        resolve: async (_root, args) =>
            toMutationResult(await removeExpenseSplit(String(args.expenseId), String(args.userId))),
    })
)
