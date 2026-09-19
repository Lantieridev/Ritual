# Offline expense entry (PWA) — design

Issue: [#10](https://github.com/Lantieridev/Ritual/issues/10) — "[Infra] Soporte offline / PWA para cargar gastos sin señal en el venue"

## Problem

Expenses are logged on the spot, at the venue, where mobile signal is often poor
or absent. Creating an expense must work offline: store it locally and sync when
connectivity returns.

## Decisions

| Question | Decision |
|---|---|
| What works offline? | **Creating expenses only.** The queue is append-only. Attendance, notes, edit and delete are follow-ups. |
| Cold start offline? | **Yes.** The installed PWA must open and show the expense form with no signal. |
| Target devices | **Android and iOS.** Background Sync is not available on iOS, so the flush is client-driven. Background Sync is out of scope. |
| Tooling | **Serwist** (via `@serwist/turbopack`) for precache/runtime caching + a small hand-written IndexedDB outbox. RxDB/PouchDB rejected: full replication is overkill for append-only inserts. |

## Current state (verified)

- GraphQL is already live (Yoga + Pothos + urql). `createExpense` is a mutation
  returning `{ id, error }`, so no migration away from Server Actions is needed.
- No manifest, service worker or offline code exists.
- `ExpenseForm` and `EventExpensesPanel` both call `createExpense` via urql.
- `/expenses/nuevo` is server-rendered and loads the event picker options.
- `createExpense` has no idempotency key.
- `@serwist/turbopack` 9.5.12 supports `next >=14` (needs `esbuild` as a peer),
  so the Next 16 Turbopack default is not a blocker.

## Architecture

- **Service worker (Serwist).** Precaches build assets; caches navigations to
  `/expenses/nuevo` and event `gastos` pages with an offline fallback.
- **Manifest and icons.** Required for install and iOS "Add to Home Screen".
- **Outbox** — `src/domains/expenses/offline/outbox.ts`. One IndexedDB store,
  `pending_expenses`: `{ clientId, payload, createdAt, status }`.
- **Flusher** — `offline/sync.ts`. Runs on mount, `online` and `visibilitychange`.
  Sends entries oldest-first through the existing `createExpense` mutation.
- **`useCreateExpense` hook.** Single place for the offline decision, used by
  `ExpenseForm` and `EventExpensesPanel`. Offline or network failure → enqueue
  and render a "Pendiente de sincronizar" row.
- **Server idempotency.** `ExpenseCreateInput` gains `clientId`; DB gains
  `client_id` with a unique `(user_id, client_id)` constraint. A retried create
  returns the existing row.

## Data flow

1. User submits. The hook generates `clientId` (`crypto.randomUUID()`) and
   writes to the outbox **first**, then attempts an immediate flush.
2. Online: the entry is removed within milliseconds; the user sees a normal save.
3. Offline: the entry stays `pending` and is shown as "Pendiente".

Outbox-first means a crash mid-request cannot lose the expense.

## Error handling

| Case | Behavior |
|---|---|
| No network, timeout, 5xx | Keep `pending`; retry on the next trigger. |
| Session expired | Keep `pending`; show "Iniciá sesión para sincronizar"; flush after login. Nothing discarded. |
| Validation error, or event deleted meanwhile | Mark `failed` with the server message. User can edit + retry or discard. Never blocks the rest of the queue. |
| Lost response (duplicate risk) | `(user_id, client_id)` unique constraint returns the existing id. |
| Two tabs flushing | `navigator.locks` serializes; idempotency covers any gap. |
| Stale event picker offline | Uses last cached list; a since-deleted event ends in the `failed` case. |

`navigator.storage.persist()` is requested at install to reduce outbox eviction risk.

## Testing

- **Unit (Vitest + `fake-indexeddb`):** outbox (enqueue, ordering, status
  transitions); flusher (success, network error, validation error, expired
  session, idempotent retry).
- **Server:** `createExpense` with a repeated `clientId` returns the same id and
  creates one row (`src/graphql/expenses.test.ts`).
- **Component:** `ExpenseForm` / `EventExpensesPanel` render the "Pendiente" row
  when the hook enqueues.
- **E2E (Playwright):** `context.setOffline(true)`, add an expense, go online,
  assert it syncs exactly once; also reload while offline. The service worker
  only registers in a production build, so this runs against
  `next build && next start`.

## Delivery

One issue, four PRs, each under ~400 changed lines:

1. **Server idempotency** — migration, GraphQL input, tests. Safe to ship alone.
2. **Outbox and flusher** — pure logic, no UI.
3. **`useCreateExpense` and "Pendiente" UI** — wires the outbox into the components.
4. **PWA shell** — manifest, icons, Serwist service worker, cold-start caching, E2E.

## Out of scope

- Offline edit/delete of expenses.
- Offline attendance and notes (the outbox can be generalized later).
- Background Sync API (Android-only enhancement).
- Multi-device conflict resolution: expenses are per-user and the queue is
  append-only, so cross-device conflicts do not arise.
