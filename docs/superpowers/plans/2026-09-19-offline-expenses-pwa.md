# Offline Expense Entry (PWA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user create expenses with no signal at the venue; the expense is stored on the device and synced exactly once when connectivity returns, on Android and iOS.

**Architecture:** A Serwist service worker precaches the app and caches the expense routes so the installed PWA cold-starts offline. Expense creation goes through a `useCreateExpense` hook that writes to an IndexedDB outbox *first*, then tries the existing `createExpense` GraphQL mutation. A client-driven flusher (mount, `online`, `visibilitychange`) drains the outbox oldest-first. The server makes `createExpense` idempotent via a client-generated `client_id`.

**Tech Stack:** Next.js 16 (Turbopack), React 19, urql + Pothos/Yoga GraphQL, Supabase, `@serwist/turbopack` + `serwist`, raw IndexedDB, Vitest + `fake-indexeddb`, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-19-offline-expenses-pwa-design.md`

## Global Constraints

- Scope is **create expense only**. No offline edit/delete, attendance or notes.
- Must work on **Android and iOS**: no Background Sync API; sync is triggered by mount, `online` and `visibilitychange`.
- The installed PWA must **cold-start offline** and show the expense form.
- The outbox write happens **before** the network call.
- Idempotency: unique `(user_id, client_id)`; a retried create returns the existing row's id.
- Reuse the existing `createExpense` GraphQL mutation; no new endpoint, no Server Actions.
- Session expired while syncing: entries stay `pending`, nothing is discarded.
- Validation-rejected entries become `failed`, never block the rest of the queue.
- `navigator.locks` serializes flushes across tabs.
- User-facing copy is Spanish with the repo's existing voseo (e.g. "Iniciá sesión"); code, comments and commits are English.
- Conventional commits, no AI attribution trailers. Each PR stays under ~400 changed lines.
- Do NOT run `supabase db push` against the remote project; note the migration in the PR description.

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260919000000_expenses_client_id.sql` | `client_id` column + partial unique index |
| `src/domains/expenses/messages.ts` | Shared constant for the "not signed in" message (server + client classify on it) |
| `src/domains/expenses/service.ts` (modify) | `insertExpense` accepts `client_id`, idempotent on retry |
| `src/graphql/expenses.ts` (modify) | `clientId` on `ExpenseCreateInput` |
| `src/domains/expenses/offline/outbox.ts` | IndexedDB outbox CRUD, change event |
| `src/domains/expenses/offline/sync.ts` | `flushOutbox` with locks; result classification types |
| `src/domains/expenses/offline/send.ts` | Maps urql results to `SendResult`; builds a sender |
| `src/domains/expenses/offline/create-expense-mutation.ts` | The `CreateExpense` gql document (single source) |
| `src/domains/expenses/offline/use-create-expense.ts` | Hook: enqueue → send → outcome |
| `src/domains/expenses/offline/use-outbox.ts` | `usePendingExpenses`, `useOutboxFlush` |
| `src/domains/expenses/offline/warm-cache.ts` | Pre-fetch the offline routes so the SW caches them |
| `src/domains/expenses/components/PendingExpensesList.tsx` | "Pendiente de sincronizar" / failed rows with retry + discard |
| `src/domains/expenses/components/OutboxSync.tsx` | Mounts the flush triggers, storage persist, cache warm |
| `src/core/components/pwa/PwaProvider.tsx` | `SerwistProvider` in production only |
| `app/serwist/[path]/route.ts`, `app/sw.ts` | Service worker build + source |
| `app/manifest.ts`, `app/~offline/page.tsx`, `public/icons/*` | Installability + offline fallback |
| `playwright.pwa.config.ts`, `e2e/pwa/offline-expenses.spec.ts` | Production-build E2E |

---

# PR 1 — Server idempotency

### Task 1: Idempotent `insertExpense` with `client_id`

**Files:**
- Create: `supabase/migrations/20260919000000_expenses_client_id.sql`
- Create: `src/domains/expenses/messages.ts`
- Modify: `src/domains/expenses/service.ts` (`requireUserId`, `insertExpense`)
- Modify: `src/core/types/index.ts` or the file that declares `ExpenseCreateInput` (find with `rg -n "interface ExpenseCreateInput" src/core/types`)
- Test: `src/domains/expenses/service.test.ts` (inside `describe('insertExpense', ...)`)

**Interfaces:**
- Produces: `ExpenseCreateInput.client_id?: string`; `EXPENSES_AUTH_REQUIRED_MESSAGE: string` exported from `src/domains/expenses/messages.ts`. `insertExpense` returns `{ id }` for a repeated `client_id` instead of an error.

- [ ] **Step 1: Write the failing tests**

Add near the other constants at the top of `service.test.ts`:

```ts
const VALID_CLIENT_ID = '33333333-3333-3333-3333-333333333333'
```

Add inside `describe('insertExpense', ...)`:

```ts
  it('rejects a malformed client_id', async () => {
    const result = await insertExpense({
      amount: 100,
      category: 'Entrada',
      date: '2024-01-01',
      client_id: 'not-a-uuid',
    })

    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('stores client_id on the inserted row', async () => {
    const builder = makeQueryBuilder({ data: { id: 'expense-1' }, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    await insertExpense({
      amount: 100,
      category: 'Entrada',
      date: '2024-01-01',
      client_id: VALID_CLIENT_ID,
    })

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ client_id: VALID_CLIENT_ID }))
  })

  it('returns the existing id when the same client_id is retried', async () => {
    const insertBuilder = makeQueryBuilder({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })
    const lookupBuilder = makeQueryBuilder({ data: { id: 'expense-1' }, error: null })
    const from = vi.fn().mockReturnValueOnce(insertBuilder).mockReturnValueOnce(lookupBuilder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from }))

    const result = await insertExpense({
      amount: 100,
      category: 'Entrada',
      date: '2024-01-01',
      client_id: VALID_CLIENT_ID,
    })

    expect(result).toEqual({ id: 'expense-1' })
    expect(lookupBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(lookupBuilder.eq).toHaveBeenCalledWith('client_id', VALID_CLIENT_ID)
  })

  it('still reports a unique violation when no client_id was sent', async () => {
    const builder = makeQueryBuilder({ data: null, error: { code: '23505', message: 'dup' } })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await insertExpense({ amount: 100, category: 'Entrada', date: '2024-01-01' })

    expect(result.error).toBeTruthy()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domains/expenses/service.test.ts -t "client_id"`
Expected: FAIL (`client_id` not accepted / not stored / duplicate not handled).

- [ ] **Step 3: Implement**

`supabase/migrations/20260919000000_expenses_client_id.sql`:

```sql
-- Issue #10: offline expense entry. The client generates a UUID per expense
-- before it ever touches the network, so a retried sync (lost response,
-- two tabs flushing) returns the existing row instead of duplicating it.
-- Partial index: rows created before this change, or by clients that don't
-- send a client_id, are unaffected.
alter table public.expenses add column client_id uuid;

create unique index expenses_user_client_id_key
  on public.expenses (user_id, client_id)
  where client_id is not null;
```

`src/domains/expenses/messages.ts`:

```ts
/**
 * Returned by insertExpense when there is no session. Lives in its own
 * module (no server imports) so the offline sync client can tell "sign in
 * again" apart from a validation error without importing service.ts.
 */
export const EXPENSES_AUTH_REQUIRED_MESSAGE = 'Iniciá sesión para registrar gastos.'
```

In `service.ts`, import it and use it in `requireUserId`:

```ts
import { EXPENSES_AUTH_REQUIRED_MESSAGE } from './messages'
// ...
    return {
      error: EXPENSES_AUTH_REQUIRED_MESSAGE,
    }
```

Add `client_id?: string` to `ExpenseCreateInput` (after `date: string`).

In `insertExpense`, after the `event_id` validation block:

```ts
  if (formData.client_id) {
    const clientIdErr = validateUUID(formData.client_id, 'Cliente')
    if (clientIdErr) return { error: clientIdErr }
  }
```

Add the key only when present (keeps existing exact-match insert assertions valid):

```ts
      date: formData.date,
      ...(formData.client_id ? { client_id: formData.client_id } : {}),
    })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505' && formData.client_id) {
      const { data: existing } = await supabase
        .from('expenses')
        .select('id')
        .eq('user_id', r.userId)
        .eq('client_id', formData.client_id)
        .single()
      if (existing) return { id: existing.id }
    }
    return { error: sanitizeError(error) }
  }
```

(Replace the existing `if (error) { return { error: sanitizeError(error) } }` after the insert with the block above.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/domains/expenses/service.test.ts`
Expected: PASS (all, including the pre-existing `insertExpense` tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260919000000_expenses_client_id.sql src/domains/expenses/messages.ts src/domains/expenses/service.ts src/domains/expenses/service.test.ts src/core/types
git commit -m "feat(expenses): make insertExpense idempotent via client_id"
```

### Task 2: `clientId` on the GraphQL `createExpense` input

**Files:**
- Modify: `src/graphql/expenses.ts` (`ExpenseCreateInput`, `createExpense` resolver)
- Test: `src/graphql/expenses.test.ts`

**Interfaces:**
- Consumes: `insertExpense` accepting `client_id` (Task 1).
- Produces: GraphQL `ExpenseCreateInput.clientId: ID` (optional).

- [ ] **Step 1: Write the failing test**

Find the existing `createExpense` test in this file (`rg -n "createExpense" src/graphql/expenses.test.ts`) and copy how it calls `query(...)` and reads the response. Add a sibling test:

```ts
  it('passes clientId through to insertExpense as client_id', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')
    vi.mocked(insertExpense).mockResolvedValue({ id: 'expense-1' })

    await query(`mutation {
      createExpense(input: {
        amount: 10, category: "Entrada", date: "2024-01-01",
        clientId: "33333333-3333-3333-3333-333333333333"
      }) { id error }
    }`)

    expect(insertExpense).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: '33333333-3333-3333-3333-333333333333' })
    )
  })

  it('still accepts createExpense without a clientId', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')
    vi.mocked(insertExpense).mockResolvedValue({ id: 'expense-2' })

    await query(`mutation {
      createExpense(input: { amount: 10, category: "Entrada", date: "2024-01-01" }) { id error }
    }`)

    expect(insertExpense).toHaveBeenCalledWith(expect.objectContaining({ client_id: undefined }))
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/graphql/expenses.test.ts -t "clientId"`
Expected: FAIL (`Field "clientId" is not defined by type "ExpenseCreateInput"`).

- [ ] **Step 3: Implement**

In `ExpenseCreateInput` add `clientId: t.id(),` after `date`. In the `createExpense` resolver add
`client_id: args.input.clientId ? String(args.input.clientId) : undefined,` after `date: args.input.date,`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/graphql/expenses.test.ts src/domains/expenses/service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/graphql/expenses.ts src/graphql/expenses.test.ts
git commit -m "feat(graphql): accept clientId on createExpense for idempotent retries"
```

---

# PR 2 — Outbox and flusher (no UI)

### Task 3: IndexedDB outbox

**Files:**
- Create: `src/domains/expenses/offline/outbox.ts`
- Test: `src/domains/expenses/offline/outbox.test.ts`
- Modify: `package.json` (dev dependency)

**Interfaces:**
- Produces (used by Tasks 4-6):
  ```ts
  export type OutboxStatus = 'pending' | 'failed'
  export interface OutboxPayload { amount: number; category: string; note?: string; eventId?: string; date: string }
  export interface OutboxEntry { clientId: string; payload: OutboxPayload; createdAt: number; status: OutboxStatus; error?: string }
  export const OUTBOX_CHANGED_EVENT = 'ritual:outbox-changed'
  export function enqueue(payload: OutboxPayload, clientId?: string): Promise<OutboxEntry>
  export function listEntries(): Promise<OutboxEntry[]>          // oldest first
  export function markFailed(clientId: string, error: string): Promise<void>
  export function requeue(clientId: string, payload?: OutboxPayload): Promise<void>
  export function removeEntry(clientId: string): Promise<void>
  ```

- [ ] **Step 1: Install the test dependency**

Run: `npm i -D fake-indexeddb`

- [ ] **Step 2: Write the failing tests**

`outbox.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import {
  enqueue,
  listEntries,
  markFailed,
  requeue,
  removeEntry,
  type OutboxPayload,
} from './outbox'

const payload: OutboxPayload = { amount: 100, category: 'Entrada', date: '2024-01-01' }

beforeEach(() => {
  // A fresh database per test; outbox.ts opens the DB lazily on every call.
  globalThis.indexedDB = new IDBFactory()
})

describe('outbox', () => {
  it('enqueues a pending entry with a generated clientId', async () => {
    const entry = await enqueue(payload)

    expect(entry.status).toBe('pending')
    expect(entry.clientId).toMatch(/^[0-9a-f-]{36}$/)
    expect(await listEntries()).toEqual([entry])
  })

  it('lists entries oldest first, even when created in the same millisecond', async () => {
    const a = await enqueue({ ...payload, note: 'a' })
    const b = await enqueue({ ...payload, note: 'b' })
    const c = await enqueue({ ...payload, note: 'c' })

    const ids = (await listEntries()).map((e) => e.clientId)
    expect(ids).toEqual([a.clientId, b.clientId, c.clientId])
  })

  it('marks an entry failed with the server message', async () => {
    const entry = await enqueue(payload)

    await markFailed(entry.clientId, 'El monto debe ser mayor a 0.')

    const [stored] = await listEntries()
    expect(stored.status).toBe('failed')
    expect(stored.error).toBe('El monto debe ser mayor a 0.')
  })

  it('requeues a failed entry, optionally with an edited payload', async () => {
    const entry = await enqueue(payload)
    await markFailed(entry.clientId, 'boom')

    await requeue(entry.clientId, { ...payload, amount: 250 })

    const [stored] = await listEntries()
    expect(stored.status).toBe('pending')
    expect(stored.error).toBeUndefined()
    expect(stored.payload.amount).toBe(250)
  })

  it('removes an entry', async () => {
    const entry = await enqueue(payload)

    await removeEntry(entry.clientId)

    expect(await listEntries()).toEqual([])
  })

  it('ignores markFailed/requeue for an unknown clientId', async () => {
    await expect(markFailed('missing', 'x')).resolves.toBeUndefined()
    await expect(requeue('missing')).resolves.toBeUndefined()
    expect(await listEntries()).toEqual([])
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/domains/expenses/offline/outbox.test.ts`
Expected: FAIL (module `./outbox` not found).

- [ ] **Step 4: Implement `outbox.ts`**

```ts
/**
 * Issue #10: on-device queue of expenses created without signal.
 *
 * Deliberately tiny — one object store, no library — because the queue is
 * append-only: entries are created, then either deleted (synced/discarded) or
 * flagged `failed`. Nothing here talks to the network; sync.ts drains it.
 */

export type OutboxStatus = 'pending' | 'failed'

export interface OutboxPayload {
  amount: number
  category: string
  note?: string
  eventId?: string
  date: string
}

export interface OutboxEntry {
  clientId: string
  payload: OutboxPayload
  createdAt: number
  status: OutboxStatus
  error?: string
}

/** Fired on `window` after every write so mounted lists can refresh. */
export const OUTBOX_CHANGED_EVENT = 'ritual:outbox-changed'

const DB_NAME = 'ritual-offline'
const STORE = 'pending_expenses'

let lastCreatedAt = 0

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'clientId' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = run(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(req.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

function notifyChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OUTBOX_CHANGED_EVENT))
}

async function getEntry(clientId: string): Promise<OutboxEntry | undefined> {
  return withStore('readonly', (store) => store.get(clientId) as IDBRequest<OutboxEntry | undefined>)
}

export async function enqueue(
  payload: OutboxPayload,
  clientId: string = crypto.randomUUID()
): Promise<OutboxEntry> {
  // Strictly increasing so ordering survives two enqueues in one millisecond.
  lastCreatedAt = Math.max(Date.now(), lastCreatedAt + 1)
  const entry: OutboxEntry = { clientId, payload, createdAt: lastCreatedAt, status: 'pending' }
  await withStore('readwrite', (store) => store.put(entry))
  notifyChanged()
  return entry
}

export async function listEntries(): Promise<OutboxEntry[]> {
  const all = await withStore('readonly', (store) => store.getAll() as IDBRequest<OutboxEntry[]>)
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function markFailed(clientId: string, error: string): Promise<void> {
  const entry = await getEntry(clientId)
  if (!entry) return
  await withStore('readwrite', (store) => store.put({ ...entry, status: 'failed', error }))
  notifyChanged()
}

export async function requeue(clientId: string, payload?: OutboxPayload): Promise<void> {
  const entry = await getEntry(clientId)
  if (!entry) return
  const { error: _error, ...rest } = entry
  await withStore('readwrite', (store) =>
    store.put({ ...rest, payload: payload ?? entry.payload, status: 'pending' })
  )
  notifyChanged()
}

export async function removeEntry(clientId: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(clientId))
  notifyChanged()
}
```

- [ ] **Step 5: Run to verify pass, then lint**

Run: `npx vitest run src/domains/expenses/offline/outbox.test.ts && npx eslint src/domains/expenses/offline`
Expected: PASS, no lint errors. (If ESLint flags the unused `_error`, rename per the repo's `no-unused-vars` config or destructure with a `// eslint-disable-next-line` comment.)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/domains/expenses/offline/outbox.ts src/domains/expenses/offline/outbox.test.ts
git commit -m "feat(expenses): add IndexedDB outbox for offline expenses"
```

### Task 4: Flusher and result classification

**Files:**
- Create: `src/domains/expenses/offline/sync.ts`
- Create: `src/domains/expenses/offline/send.ts`
- Create: `src/domains/expenses/offline/create-expense-mutation.ts`
- Test: `src/domains/expenses/offline/sync.test.ts`, `src/domains/expenses/offline/send.test.ts`

**Interfaces:**
- Consumes: `OutboxEntry`, `listEntries`, `markFailed`, `removeEntry` (Task 3); `EXPENSES_AUTH_REQUIRED_MESSAGE` (Task 1); `MALFORMED_RESPONSE_MESSAGE`, `TRANSPORT_ERROR_MESSAGE`, `unwrapMutation`, `UrqlMutationResult` from `src/graphql/mutation-result.ts`.
- Produces:
  ```ts
  // sync.ts
  export type SendResult =
    | { ok: true; id: string }
    | { ok: false; kind: 'network' | 'auth' | 'rejected'; message: string }
  export type SendExpense = (entry: OutboxEntry) => Promise<SendResult>
  export interface FlushSummary { synced: number; failed: number; remaining: number; skipped: boolean }
  export function flushOutbox(send: SendExpense): Promise<FlushSummary>
  // send.ts
  export function toSendResult(result: UrqlMutationResult | null | undefined): SendResult
  export function makeSender(execute: (vars: { input: Record<string, unknown> }) => Promise<UrqlMutationResult>): SendExpense
  // create-expense-mutation.ts
  export const CreateExpenseMutation  // gql document, operation name "CreateExpense"
  ```

- [ ] **Step 1: Write the failing tests**

`sync.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { enqueue, listEntries } from './outbox'
import { flushOutbox, type SendExpense } from './sync'

const payload = { amount: 100, category: 'Entrada', date: '2024-01-01' }

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('flushOutbox', () => {
  it('sends pending entries oldest first and removes the synced ones', async () => {
    const a = await enqueue({ ...payload, note: 'a' })
    const b = await enqueue({ ...payload, note: 'b' })
    const send: SendExpense = vi.fn().mockResolvedValue({ ok: true, id: 'srv' })

    const summary = await flushOutbox(send)

    expect(vi.mocked(send).mock.calls.map(([e]) => e.clientId)).toEqual([a.clientId, b.clientId])
    expect(summary).toEqual({ synced: 2, failed: 0, remaining: 0, skipped: false })
    expect(await listEntries()).toEqual([])
  })

  it('stops at the first network failure and keeps everything pending', async () => {
    await enqueue(payload)
    await enqueue(payload)
    const send: SendExpense = vi.fn().mockResolvedValue({ ok: false, kind: 'network', message: 'offline' })

    const summary = await flushOutbox(send)

    expect(send).toHaveBeenCalledTimes(1)
    expect(summary).toMatchObject({ synced: 0, failed: 0, remaining: 2 })
    expect((await listEntries()).every((e) => e.status === 'pending')).toBe(true)
  })

  it('stops on an expired session and keeps the entries pending', async () => {
    await enqueue(payload)
    const send: SendExpense = vi.fn().mockResolvedValue({ ok: false, kind: 'auth', message: 'Iniciá sesión' })

    const summary = await flushOutbox(send)

    expect(summary).toMatchObject({ synced: 0, remaining: 1 })
    expect((await listEntries())[0].status).toBe('pending')
  })

  it('marks a rejected entry failed and keeps draining the rest', async () => {
    const bad = await enqueue({ ...payload, amount: 0 })
    await enqueue({ ...payload, note: 'ok' })
    const send: SendExpense = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, kind: 'rejected', message: 'El monto debe ser mayor a 0.' })
      .mockResolvedValueOnce({ ok: true, id: 'srv' })

    const summary = await flushOutbox(send)

    expect(summary).toEqual({ synced: 1, failed: 1, remaining: 0, skipped: false })
    const left = await listEntries()
    expect(left).toHaveLength(1)
    expect(left[0]).toMatchObject({ clientId: bad.clientId, status: 'failed', error: 'El monto debe ser mayor a 0.' })
  })

  it('treats a throwing sender like a network failure', async () => {
    await enqueue(payload)
    const send: SendExpense = vi.fn().mockRejectedValue(new Error('boom'))

    const summary = await flushOutbox(send)

    expect(summary).toMatchObject({ synced: 0, remaining: 1 })
  })

  it('skips failed entries', async () => {
    const e = await enqueue(payload)
    const { markFailed } = await import('./outbox')
    await markFailed(e.clientId, 'x')
    const send: SendExpense = vi.fn()

    await flushOutbox(send)

    expect(send).not.toHaveBeenCalled()
  })

  it('does nothing when another tab holds the flush lock', async () => {
    await enqueue(payload)
    vi.stubGlobal('navigator', {
      locks: { request: vi.fn((_name, _opts, cb) => cb(null)) },
    })
    const send: SendExpense = vi.fn()

    const summary = await flushOutbox(send)

    expect(send).not.toHaveBeenCalled()
    expect(summary.skipped).toBe(true)
  })

  it('runs inside the lock when navigator.locks is available', async () => {
    await enqueue(payload)
    const request = vi.fn((_name, _opts, cb) => cb({ name: 'lock' }))
    vi.stubGlobal('navigator', { locks: { request } })
    const send: SendExpense = vi.fn().mockResolvedValue({ ok: true, id: 'srv' })

    const summary = await flushOutbox(send)

    expect(request).toHaveBeenCalledWith('ritual-outbox-flush', { ifAvailable: true }, expect.any(Function))
    expect(summary.synced).toBe(1)
  })
})
```

`send.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { CombinedError } from 'urql'
import { toSendResult, makeSender } from './send'
import { EXPENSES_AUTH_REQUIRED_MESSAGE } from '@/src/domains/expenses/messages'
import { TRANSPORT_ERROR_MESSAGE, MALFORMED_RESPONSE_MESSAGE } from '@/src/graphql/mutation-result'
import { transportError } from '@/src/graphql/transport-failure.testing'

describe('toSendResult', () => {
  it('maps a created expense to ok', () => {
    expect(toSendResult({ data: { createExpense: { id: 'x1' } } })).toEqual({ ok: true, id: 'x1' })
  })

  it('maps a network error to kind "network"', () => {
    expect(toSendResult({ data: undefined, error: transportError() })).toEqual({
      ok: false,
      kind: 'network',
      message: TRANSPORT_ERROR_MESSAGE,
    })
  })

  it('treats a missing result as a network failure', () => {
    expect(toSendResult(undefined)).toMatchObject({ ok: false, kind: 'network' })
  })

  it('maps GraphQL-level errors (no network error) to "rejected", not a retry loop', () => {
    const error = new CombinedError({ graphQLErrors: ['Unknown field'] })
    expect(toSendResult({ data: undefined, error })).toEqual({
      ok: false,
      kind: 'rejected',
      message: MALFORMED_RESPONSE_MESSAGE,
    })
  })

  it('maps the not-signed-in message to kind "auth"', () => {
    expect(toSendResult({ data: { createExpense: { error: EXPENSES_AUTH_REQUIRED_MESSAGE } } })).toEqual({
      ok: false,
      kind: 'auth',
      message: EXPENSES_AUTH_REQUIRED_MESSAGE,
    })
  })

  it('maps any other business error to "rejected"', () => {
    expect(toSendResult({ data: { createExpense: { error: 'El monto debe ser mayor a 0.' } } })).toEqual({
      ok: false,
      kind: 'rejected',
      message: 'El monto debe ser mayor a 0.',
    })
  })

  it('maps a payload without id or error to "rejected"', () => {
    expect(toSendResult({ data: { createExpense: {} } })).toMatchObject({ ok: false, kind: 'rejected' })
  })
})

describe('makeSender', () => {
  it('sends the payload plus the entry clientId as input', async () => {
    const execute = vi.fn().mockResolvedValue({ data: { createExpense: { id: 'x1' } } })
    const send = makeSender(execute)

    const result = await send({
      clientId: 'c-1',
      payload: { amount: 5, category: 'Entrada', date: '2024-01-01' },
      createdAt: 1,
      status: 'pending',
    })

    expect(execute).toHaveBeenCalledWith({
      input: { amount: 5, category: 'Entrada', date: '2024-01-01', clientId: 'c-1' },
    })
    expect(result).toEqual({ ok: true, id: 'x1' })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/domains/expenses/offline/sync.test.ts src/domains/expenses/offline/send.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`create-expense-mutation.ts`:

```ts
import { gql } from 'urql'

/**
 * The single `CreateExpense` document. The operation name matters: the
 * component tests route their urql double by it.
 */
export const CreateExpenseMutation = gql`
  mutation CreateExpense($input: ExpenseCreateInput!) {
    createExpense(input: $input) { id error }
  }
`
```

`sync.ts`:

```ts
import { listEntries, markFailed, removeEntry, type OutboxEntry } from './outbox'

/**
 * How the server answered one queued expense.
 * - network:  never reached the resolver (offline, timeout, 5xx) → retry later.
 * - auth:     session expired → keep the entry, retry after sign-in.
 * - rejected: the server refused it (validation, deleted event) → needs the user.
 */
export type SendResult =
  | { ok: true; id: string }
  | { ok: false; kind: 'network' | 'auth' | 'rejected'; message: string }

export type SendExpense = (entry: OutboxEntry) => Promise<SendResult>

export interface FlushSummary {
  synced: number
  failed: number
  remaining: number
  /** True when another tab held the lock, so this call did nothing. */
  skipped: boolean
}

const LOCK_NAME = 'ritual-outbox-flush'

async function drain(send: SendExpense): Promise<FlushSummary> {
  let synced = 0
  let failed = 0

  const pending = (await listEntries()).filter((e) => e.status === 'pending')
  for (const entry of pending) {
    let result: SendResult
    try {
      result = await send(entry)
    } catch {
      break
    }

    if (result.ok) {
      await removeEntry(entry.clientId)
      synced++
    } else if (result.kind === 'rejected') {
      await markFailed(entry.clientId, result.message)
      failed++
    } else {
      // network / auth: nothing later in the queue will fare better right now.
      break
    }
  }

  const remaining = (await listEntries()).filter((e) => e.status === 'pending').length
  return { synced, failed, remaining, skipped: false }
}

/**
 * Drains the outbox oldest-first. Serialized across tabs with Web Locks; the
 * server-side (user_id, client_id) constraint covers any gap (and browsers
 * without Web Locks), so a double send is harmless.
 */
export async function flushOutbox(send: SendExpense): Promise<FlushSummary> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    const summary = await navigator.locks.request(LOCK_NAME, { ifAvailable: true }, (lock) =>
      lock ? drain(send) : null
    )
    return summary ?? { synced: 0, failed: 0, remaining: 0, skipped: true }
  }
  return drain(send)
}
```

`send.ts`:

```ts
import {
  MALFORMED_RESPONSE_MESSAGE,
  TRANSPORT_ERROR_MESSAGE,
  unwrapMutation,
  type UrqlMutationResult,
} from '@/src/graphql/mutation-result'
import { EXPENSES_AUTH_REQUIRED_MESSAGE } from '@/src/domains/expenses/messages'
import type { SendExpense, SendResult } from './sync'

/** Collapses an urql `createExpense` result into what the flusher branches on. */
export function toSendResult(result: UrqlMutationResult | null | undefined): SendResult {
  if (!result) return { ok: false, kind: 'network', message: TRANSPORT_ERROR_MESSAGE }

  if (result.error) {
    // urql sets networkError only when the request never produced a GraphQL
    // response. GraphQL-level errors mean the server understood and refused —
    // retrying would loop forever, so surface them as rejected.
    const isNetwork = Boolean((result.error as { networkError?: unknown }).networkError)
    return isNetwork
      ? { ok: false, kind: 'network', message: TRANSPORT_ERROR_MESSAGE }
      : { ok: false, kind: 'rejected', message: MALFORMED_RESPONSE_MESSAGE }
  }

  const payload = unwrapMutation<{ id?: string; error?: string }>(result, 'createExpense')
  if (payload.error) {
    return {
      ok: false,
      kind: payload.error === EXPENSES_AUTH_REQUIRED_MESSAGE ? 'auth' : 'rejected',
      message: payload.error,
    }
  }
  return payload.id
    ? { ok: true, id: payload.id }
    : { ok: false, kind: 'rejected', message: MALFORMED_RESPONSE_MESSAGE }
}

/** Builds the `send` the flusher and the create hook share, from urql's executor. */
export function makeSender(
  execute: (vars: { input: Record<string, unknown> }) => Promise<UrqlMutationResult>
): SendExpense {
  return async (entry) =>
    toSendResult(await execute({ input: { ...entry.payload, clientId: entry.clientId } }))
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/domains/expenses/offline && npx tsc --noEmit`
Expected: PASS; no type errors. (If `navigator.locks.request` typing rejects the callback returning `null`, widen the callback's return with `as Promise<FlushSummary | null> | null`.)

- [ ] **Step 5: Commit**

```bash
git add src/domains/expenses/offline
git commit -m "feat(expenses): add outbox flusher and send-result classification"
```

---

# PR 3 — Hook and "Pendiente" UI

### Task 5: `useCreateExpense` and the create paths

**Files:**
- Create: `src/domains/expenses/offline/use-create-expense.ts`
- Test: `src/domains/expenses/offline/use-create-expense.test.tsx`
- Modify: `src/domains/expenses/components/ExpenseForm.tsx`
- Modify: `src/domains/expenses/components/EventExpensesPanel.tsx`
- Modify: `src/domains/expenses/components/ExpenseQuickAdd.tsx`
- Modify tests: `ExpenseForm.test.tsx`, `EventExpensesPanel.test.tsx`, `ExpenseQuickAdd.test.tsx` (same folder)

**Interfaces:**
- Consumes: `enqueue`, `removeEntry`, `OutboxPayload` (Task 3); `makeSender`, `CreateExpenseMutation` (Task 4).
- Produces:
  ```ts
  export type CreateExpenseOutcome =
    | { status: 'synced'; id: string }
    | { status: 'queued'; clientId: string }
    | { status: 'rejected'; error: string }
  export function useCreateExpense(): (payload: OutboxPayload) => Promise<CreateExpenseOutcome>
  ```
  `ExpenseQuickAdd` prop `insertExpense` now returns `Promise<{ error?: string; id?: string; queued?: boolean }>` and it gains a required `onQueued: () => void` prop.

- [ ] **Step 1: Write the failing hook tests**

`use-create-expense.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'
import { listEntries } from './outbox'
import { transportError } from '@/src/graphql/transport-failure.testing'
import { EXPENSES_AUTH_REQUIRED_MESSAGE } from '@/src/domains/expenses/messages'

const createExpenseMock = vi.fn()
vi.mock('urql', async () => {
  const actual = await vi.importActual<typeof import('urql')>('urql')
  return { ...actual, useMutation: () => [{ fetching: false }, createExpenseMock] }
})

import { useCreateExpense } from './use-create-expense'

const payload = { amount: 100, category: 'Entrada', date: '2024-01-01' }

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.indexedDB = new IDBFactory()
})

describe('useCreateExpense', () => {
  it('returns synced and leaves the outbox empty when the server accepts it', async () => {
    createExpenseMock.mockResolvedValue({ data: { createExpense: { id: 'srv-1' } } })
    const { result } = renderHook(() => useCreateExpense())

    const outcome = await result.current(payload)

    expect(outcome).toEqual({ status: 'synced', id: 'srv-1' })
    expect(await listEntries()).toEqual([])
  })

  it('sends a clientId and writes to the outbox before the network call', async () => {
    let entriesAtSendTime = 0
    createExpenseMock.mockImplementation(async () => {
      entriesAtSendTime = (await listEntries()).length
      return { data: { createExpense: { id: 'srv-1' } } }
    })
    const { result } = renderHook(() => useCreateExpense())

    await result.current(payload)

    expect(entriesAtSendTime).toBe(1)
    expect(createExpenseMock).toHaveBeenCalledWith({
      input: expect.objectContaining({ amount: 100, clientId: expect.any(String) }),
    })
  })

  it('queues the expense when the network is down', async () => {
    createExpenseMock.mockResolvedValue({ data: undefined, error: transportError() })
    const { result } = renderHook(() => useCreateExpense())

    const outcome = await result.current(payload)

    expect(outcome).toMatchObject({ status: 'queued' })
    const [entry] = await listEntries()
    expect(entry.status).toBe('pending')
    expect(entry.payload).toEqual(payload)
  })

  it('queues the expense when the session expired', async () => {
    createExpenseMock.mockResolvedValue({ data: { createExpense: { error: EXPENSES_AUTH_REQUIRED_MESSAGE } } })
    const { result } = renderHook(() => useCreateExpense())

    const outcome = await result.current(payload)

    expect(outcome).toMatchObject({ status: 'queued' })
    expect(await listEntries()).toHaveLength(1)
  })

  it('returns rejected and does not keep the entry when the server refuses it', async () => {
    createExpenseMock.mockResolvedValue({ data: { createExpense: { error: 'El monto debe ser mayor a 0.' } } })
    const { result } = renderHook(() => useCreateExpense())

    const outcome = await result.current(payload)

    expect(outcome).toEqual({ status: 'rejected', error: 'El monto debe ser mayor a 0.' })
    expect(await listEntries()).toEqual([])
  })

  it('still attempts the request when IndexedDB is unavailable', async () => {
    // Simulates storage being blocked (e.g. some private modes).
    // @ts-expect-error deliberately breaking the global
    globalThis.indexedDB = { open: () => { throw new Error('blocked') } }
    createExpenseMock.mockResolvedValue({ data: { createExpense: { id: 'srv-9' } } })
    const { result } = renderHook(() => useCreateExpense())

    expect(await result.current(payload)).toEqual({ status: 'synced', id: 'srv-9' })
  })

  it('reports a transport error as rejected when it cannot be stored either', async () => {
    // @ts-expect-error deliberately breaking the global
    globalThis.indexedDB = { open: () => { throw new Error('blocked') } }
    createExpenseMock.mockResolvedValue({ data: undefined, error: transportError() })
    const { result } = renderHook(() => useCreateExpense())

    expect(await result.current(payload)).toMatchObject({ status: 'rejected' })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/domains/expenses/offline/use-create-expense.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the hook**

`use-create-expense.ts`:

```ts
'use client'

import { useCallback } from 'react'
import { useMutation } from 'urql'
import { CreateExpenseMutation } from './create-expense-mutation'
import { enqueue, removeEntry, type OutboxEntry, type OutboxPayload } from './outbox'
import { makeSender } from './send'

export type CreateExpenseOutcome =
  | { status: 'synced'; id: string }
  | { status: 'queued'; clientId: string }
  | { status: 'rejected'; error: string }

/**
 * The one place that decides "online save or offline queue" for a new
 * expense. The entry is written to the outbox BEFORE the request, so a crash
 * or a killed tab mid-request cannot lose it; the clientId makes a retry
 * idempotent on the server.
 *
 * - synced:   the server accepted it; the outbox entry is gone.
 * - queued:   no network / session expired; it stays pending for the flusher.
 * - rejected: the server refused it (validation); nothing is kept, the caller
 *             shows the message inline exactly like before offline support.
 */
export function useCreateExpense() {
  const [, createExpenseM] = useMutation(CreateExpenseMutation)

  return useCallback(
    async (payload: OutboxPayload): Promise<CreateExpenseOutcome> => {
      let entry: OutboxEntry
      let persisted = true
      try {
        entry = await enqueue(payload)
      } catch {
        // Storage blocked: still try the network, just without a safety net.
        persisted = false
        entry = { clientId: crypto.randomUUID(), payload, createdAt: Date.now(), status: 'pending' }
      }

      const result = await makeSender(createExpenseM)(entry)
      if (result.ok) {
        if (persisted) await removeEntry(entry.clientId)
        return { status: 'synced', id: result.id }
      }
      if (result.kind === 'rejected' || !persisted) {
        if (persisted) await removeEntry(entry.clientId)
        return { status: 'rejected', error: result.message }
      }
      return { status: 'queued', clientId: entry.clientId }
    },
    [createExpenseM]
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/domains/expenses/offline/use-create-expense.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire `ExpenseForm` (create path only)**

In `ExpenseForm.tsx`:
- Remove the local `CreateExpenseMutation` gql and the `createExpenseM` line; keep `UpdateExpenseMutation`/`updateExpenseM`.
- Add `import { useCreateExpense } from '@/src/domains/expenses/offline/use-create-expense'` and `const createExpense = useCreateExpense()`.
- Add state: `const [notice, setNotice] = useState<string | null>(null)`; clear it with `setNotice(null)` next to `setError(null)` at the top of `handleSubmit`.
- Replace the create `else` branch with:

```tsx
    } else {
      const outcome = await createExpense(payload)
      if (outcome.status === 'rejected') {
        setError(outcome.error)
        setIsSubmitting(false)
      } else if (outcome.status === 'queued') {
        // Stay on the form: offline, navigating to the list may have no cached
        // page, and at the venue the next expense is usually right behind this one.
        form.reset()
        setNotice('Guardado en tu dispositivo. Se sincroniza cuando vuelva la señal.')
        setIsSubmitting(false)
      } else {
        router.push(routes.expenses.list)
      }
    }
```

- Render the notice above the error block:

```tsx
      {notice && (
        <div role="status" className="bg-ritual-surface border border-ritual-border text-ritual-bone px-4 py-3 font-body text-sm">
          {notice}
        </div>
      )}
```

- [ ] **Step 6: Update `ExpenseForm.test.tsx`**

The existing urql double (`useMutation` routed by operation name) keeps working because the hook also calls `useMutation` with the `CreateExpense` document. Two changes:
1. Add at the top, after the imports: `import { IDBFactory } from 'fake-indexeddb'` and in the existing `beforeEach` of the create-mode `describe`: `globalThis.indexedDB = new IDBFactory()`.
2. Find the create-mode test that asserts `TRANSPORT_ERROR_MESSAGE` after a transport failure (`rg -n "transportError" src/domains/expenses/components/ExpenseForm.test.tsx`). Its behavior intentionally changed (a network failure now queues instead of erroring). Replace its assertions with:

```tsx
    expect(await screen.findByRole('status')).toHaveTextContent('Guardado en tu dispositivo')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
```

Leave the edit-mode transport test untouched (edit stays online-only). Add one new test in create mode:

```tsx
  it('shows the validation message inline when the server refuses the expense', async () => {
    createExpenseMock.mockResolvedValue({ data: { createExpense: { error: 'El monto debe ser mayor a 0.' } } })
    render(<ExpenseForm events={events} />)

    await userEvent.type(screen.getByLabelText(/Monto/), '1500')
    await userEvent.selectOptions(screen.getByLabelText(/Categoría/), 'Entrada')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar gasto' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El monto debe ser mayor a 0.')
  })
```

Run: `npx vitest run src/domains/expenses/components/ExpenseForm.test.tsx`
Expected: PASS.

- [ ] **Step 7: Wire `ExpenseQuickAdd` and `EventExpensesPanel`**

`ExpenseQuickAdd.tsx`: change the `insertExpense` prop type's return to `Promise<{ error?: string; id?: string; queued?: boolean }>`, add `onQueued: () => void` to the props interface and destructuring, and in `handleSubmit`'s transition, right after `const result = await insertExpense({...})`:

```tsx
      if (result.queued) {
        onQueued()
        return
      }
```

`EventExpensesPanel.tsx`:
- Remove the local `CreateExpenseMutation` gql and `createExpenseM`.
- Add `import { useCreateExpense } from '@/src/domains/expenses/offline/use-create-expense'` and `import type { OutboxPayload } from '@/src/domains/expenses/offline/outbox'`; `const createExpense = useCreateExpense()`.
- Add `const [notice, setNotice] = useState<string | null>(null)`.
- Replace `handleInsert` with:

```tsx
  async function handleInsert(expenseData: OutboxPayload) {
    const outcome = await createExpense(expenseData)
    if (outcome.status === 'synced') return { id: outcome.id }
    if (outcome.status === 'queued') return { queued: true as const }
    return { error: outcome.error }
  }

  function handleQueued() {
    setShowQuickAdd(false)
    setNotice('Guardado en tu dispositivo. Se sincroniza cuando vuelva la señal.')
  }
```

- Pass `onQueued={handleQueued}` where `<ExpenseQuickAdd ... />` is rendered (find with `rg -n "ExpenseQuickAdd" src/domains/expenses/components/EventExpensesPanel.tsx`), and render the notice just above it: `{notice && <p role="status" className="font-body text-sm text-ritual-bone">{notice}</p>}`. Clear it in `handleAdded` with `setNotice(null)`.

- [ ] **Step 8: Update the panel and quick-add tests**

In `ExpenseQuickAdd.test.tsx` add `onQueued: vi.fn()` to whatever props factory/render helper builds the component (`rg -n "onCancel" src/domains/expenses/components/ExpenseQuickAdd.test.tsx`), then add:

```tsx
  it('calls onQueued (not onAdded) when the expense was saved offline', async () => {
    const insertExpense = vi.fn().mockResolvedValue({ queued: true })
    const onAdded = vi.fn()
    const onQueued = vi.fn()
    render(
      <ExpenseQuickAdd eventId="e1" defaultDate="2024-05-01" insertExpense={insertExpense}
        onAdded={onAdded} onQueued={onQueued} onCancel={vi.fn()} />
    )

    await userEvent.type(screen.getByLabelText('Monto'), '500')
    await userEvent.selectOptions(screen.getByLabelText(/Categor/), 'Entrada')
    await userEvent.click(screen.getByRole('button', { name: /Agregar|Guardar|Cargar/ }))

    await waitFor(() => expect(onQueued).toHaveBeenCalledTimes(1))
    expect(onAdded).not.toHaveBeenCalled()
  })
```

(Adjust the query names to match the file's existing tests; copy how the nearest existing test types the amount and picks the category.) In `EventExpensesPanel.test.tsx`, add `import { IDBFactory } from 'fake-indexeddb'` and `globalThis.indexedDB = new IDBFactory()` in its `beforeEach`; if a test there asserts an error after a create transport failure, change it to expect the "Guardado en tu dispositivo" notice like Step 6.

Run: `npx vitest run src/domains/expenses && npx tsc --noEmit && npx eslint src/domains/expenses`
Expected: PASS, no type or lint errors.

- [ ] **Step 9: Commit**

```bash
git add src/domains/expenses
git commit -m "feat(expenses): queue expenses offline via useCreateExpense"
```

### Task 6: Pending list, retry/discard and flush triggers

**Files:**
- Create: `src/domains/expenses/offline/use-outbox.ts`
- Create: `src/domains/expenses/offline/warm-cache.ts`
- Create: `src/domains/expenses/components/PendingExpensesList.tsx`
- Create: `src/domains/expenses/components/OutboxSync.tsx`
- Modify: `src/domains/expenses/components/index.ts` (export both components)
- Modify: `app/layout.tsx` (mount `<OutboxSync />` for signed-in users)
- Modify: `app/expenses/page.tsx`, `app/expenses/nuevo/page.tsx`, `EventExpensesPanel.tsx` (render the list)
- Test: `use-outbox.test.tsx`, `warm-cache.test.ts`, `PendingExpensesList.test.tsx`, `OutboxSync.test.tsx`

**Interfaces:**
- Consumes: `listEntries`, `requeue`, `removeEntry`, `OUTBOX_CHANGED_EVENT`, `OutboxEntry` (Task 3); `flushOutbox`, `FlushSummary` (Task 4); `makeSender`, `CreateExpenseMutation` (Task 4).
- Produces:
  ```ts
  export function usePendingExpenses(eventId?: string): OutboxEntry[]
  export function useOutboxFlush(): () => Promise<FlushSummary>
  export const OFFLINE_ROUTES: readonly string[]
  export function warmOfflineRoutes(fetchFn?: typeof fetch): Promise<void>
  ```

- [ ] **Step 1: Write the failing tests**

`warm-cache.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { OFFLINE_ROUTES, warmOfflineRoutes } from './warm-cache'

afterEach(() => vi.unstubAllGlobals())

describe('warmOfflineRoutes', () => {
  it('fetches every offline route so the service worker can cache it', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const fetchFn = vi.fn().mockResolvedValue(new Response('ok'))

    await warmOfflineRoutes(fetchFn)

    expect(fetchFn.mock.calls.map(([url]) => url)).toEqual([...OFFLINE_ROUTES])
  })

  it('does nothing while offline', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const fetchFn = vi.fn()

    await warmOfflineRoutes(fetchFn)

    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('never throws when a fetch fails', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const fetchFn = vi.fn().mockRejectedValue(new Error('offline'))

    await expect(warmOfflineRoutes(fetchFn)).resolves.toBeUndefined()
  })
})
```

`use-outbox.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'
import { enqueue, removeEntry } from './outbox'

const createExpenseMock = vi.fn()
vi.mock('urql', async () => {
  const actual = await vi.importActual<typeof import('urql')>('urql')
  return { ...actual, useMutation: () => [{ fetching: false }, createExpenseMock] }
})

import { usePendingExpenses, useOutboxFlush } from './use-outbox'

const payload = { amount: 100, category: 'Entrada', date: '2024-01-01' }

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.indexedDB = new IDBFactory()
})

describe('usePendingExpenses', () => {
  it('lists entries and refreshes when the outbox changes', async () => {
    const { result } = renderHook(() => usePendingExpenses())
    await waitFor(() => expect(result.current).toEqual([]))

    let entry!: Awaited<ReturnType<typeof enqueue>>
    await act(async () => {
      entry = await enqueue(payload)
    })
    await waitFor(() => expect(result.current).toHaveLength(1))

    await act(async () => {
      await removeEntry(entry.clientId)
    })
    await waitFor(() => expect(result.current).toEqual([]))
  })

  it('filters by eventId when given', async () => {
    await enqueue({ ...payload, eventId: 'e1' })
    await enqueue({ ...payload, eventId: 'e2' })
    await enqueue(payload)

    const { result } = renderHook(() => usePendingExpenses('e1'))

    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(result.current[0].payload.eventId).toBe('e1')
  })
})

describe('useOutboxFlush', () => {
  it('flushes the outbox through the CreateExpense mutation', async () => {
    createExpenseMock.mockResolvedValue({ data: { createExpense: { id: 'srv-1' } } })
    await enqueue(payload)
    const { result } = renderHook(() => useOutboxFlush())

    const summary = await result.current()

    expect(summary).toMatchObject({ synced: 1, remaining: 0 })
  })
})
```

`PendingExpensesList.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IDBFactory } from 'fake-indexeddb'
import { enqueue, markFailed, listEntries } from '@/src/domains/expenses/offline/outbox'

const createExpenseMock = vi.fn()
vi.mock('urql', async () => {
  const actual = await vi.importActual<typeof import('urql')>('urql')
  return { ...actual, useMutation: () => [{ fetching: false }, createExpenseMock] }
})

import { PendingExpensesList } from './PendingExpensesList'

const payload = { amount: 1500, category: 'Entrada', date: '2024-01-01', note: 'Uber' }

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.indexedDB = new IDBFactory()
})

describe('PendingExpensesList', () => {
  it('renders nothing when the outbox is empty', async () => {
    const { container } = render(<PendingExpensesList />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('shows a pending entry as "Pendiente de sincronizar"', async () => {
    await enqueue(payload)

    render(<PendingExpensesList />)

    expect(await screen.findByText('Pendiente de sincronizar')).toBeInTheDocument()
    expect(screen.getByText(/Uber/)).toBeInTheDocument()
  })

  it('shows a failed entry with its reason and lets the user discard it', async () => {
    const entry = await enqueue(payload)
    await markFailed(entry.clientId, 'El monto debe ser mayor a 0.')

    render(<PendingExpensesList />)

    expect(await screen.findByText(/El monto debe ser mayor a 0\./)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }))

    await waitFor(async () => expect(await listEntries()).toEqual([]))
  })

  it('retries a failed entry: requeues it and flushes', async () => {
    createExpenseMock.mockResolvedValue({ data: { createExpense: { id: 'srv-1' } } })
    const entry = await enqueue(payload)
    await markFailed(entry.clientId, 'boom')

    render(<PendingExpensesList />)
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))

    await waitFor(async () => expect(await listEntries()).toEqual([]))
    expect(createExpenseMock).toHaveBeenCalledTimes(1)
  })

  it('only shows entries for the given event', async () => {
    await enqueue({ ...payload, eventId: 'e1', note: 'aqui' })
    await enqueue({ ...payload, eventId: 'e2', note: 'otro' })

    render(<PendingExpensesList eventId="e1" />)

    expect(await screen.findByText(/aqui/)).toBeInTheDocument()
    expect(screen.queryByText(/otro/)).not.toBeInTheDocument()
  })
})
```

`OutboxSync.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const flush = vi.fn().mockResolvedValue({ synced: 0, failed: 0, remaining: 0, skipped: false })
vi.mock('@/src/domains/expenses/offline/use-outbox', () => ({
  useOutboxFlush: () => flush,
}))
const warm = vi.fn().mockResolvedValue(undefined)
vi.mock('@/src/domains/expenses/offline/warm-cache', () => ({
  warmOfflineRoutes: () => warm(),
}))

import { OutboxSync } from './OutboxSync'

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})

describe('OutboxSync', () => {
  it('flushes and warms the offline routes on mount', () => {
    render(<OutboxSync />)

    expect(flush).toHaveBeenCalledTimes(1)
    expect(warm).toHaveBeenCalledTimes(1)
  })

  it('flushes when the browser comes back online', () => {
    render(<OutboxSync />)
    flush.mockClear()

    window.dispatchEvent(new Event('online'))

    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('flushes when the tab becomes visible again', () => {
    render(<OutboxSync />)
    flush.mockClear()

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('does not flush while offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    render(<OutboxSync />)

    expect(flush).not.toHaveBeenCalled()
  })

  it('stops listening after unmount', () => {
    const { unmount } = render(<OutboxSync />)
    unmount()
    flush.mockClear()

    window.dispatchEvent(new Event('online'))

    expect(flush).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/domains/expenses/offline src/domains/expenses/components/PendingExpensesList.test.tsx src/domains/expenses/components/OutboxSync.test.tsx`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`warm-cache.ts`:

```ts
/**
 * Routes the installed PWA must be able to open with no signal. Fetching
 * them once while online, from a page the service worker controls, is what
 * puts them in its runtime cache — they sit behind auth, so they can't be
 * precached at build time.
 */
export const OFFLINE_ROUTES = ['/', '/expenses/nuevo'] as const

export async function warmOfflineRoutes(fetchFn: typeof fetch = fetch): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  await Promise.allSettled(OFFLINE_ROUTES.map((url) => fetchFn(url, { credentials: 'same-origin' })))
}
```

`use-outbox.ts`:

```ts
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useMutation } from 'urql'
import { CreateExpenseMutation } from './create-expense-mutation'
import { OUTBOX_CHANGED_EVENT, listEntries, type OutboxEntry } from './outbox'
import { makeSender } from './send'
import { flushOutbox, type FlushSummary } from './sync'

/** The outbox contents (oldest first), kept fresh across writes and tabs' own writes. */
export function usePendingExpenses(eventId?: string): OutboxEntry[] {
  const [entries, setEntries] = useState<OutboxEntry[]>([])

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      listEntries()
        .then((all) => {
          if (!cancelled) setEntries(eventId ? all.filter((e) => e.payload.eventId === eventId) : all)
        })
        .catch(() => {
          if (!cancelled) setEntries([])
        })
    }
    refresh()
    window.addEventListener(OUTBOX_CHANGED_EVENT, refresh)
    return () => {
      cancelled = true
      window.removeEventListener(OUTBOX_CHANGED_EVENT, refresh)
    }
  }, [eventId])

  return entries
}

/** Drains the outbox through the real CreateExpense mutation. */
export function useOutboxFlush(): () => Promise<FlushSummary> {
  const [, createExpenseM] = useMutation(CreateExpenseMutation)
  return useCallback(() => flushOutbox(makeSender(createExpenseM)), [createExpenseM])
}
```

`components/PendingExpensesList.tsx`:

```tsx
'use client'

import { Button } from '@/src/core/components/ui'
import { removeEntry, requeue } from '@/src/domains/expenses/offline/outbox'
import { useOutboxFlush, usePendingExpenses } from '@/src/domains/expenses/offline/use-outbox'

function formatARS(amount: number) {
  return `$${amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

interface PendingExpensesListProps {
  /** Only show entries linked to this event (used on the event page). */
  eventId?: string
}

/**
 * Expenses saved on this device that the server hasn't confirmed yet.
 * `pending` ones sync by themselves; `failed` ones were refused by the
 * server and wait for the user to retry or discard them.
 */
export function PendingExpensesList({ eventId }: PendingExpensesListProps) {
  const entries = usePendingExpenses(eventId)
  const flush = useOutboxFlush()

  if (entries.length === 0) return null

  async function retry(clientId: string) {
    await requeue(clientId)
    await flush()
  }

  return (
    <ul className="space-y-2" aria-label="Gastos pendientes de sincronizar">
      {entries.map((entry) => (
        <li
          key={entry.clientId}
          className="border border-ritual-border bg-ritual-surface px-4 py-3 font-body text-sm text-ritual-bone"
        >
          <p>
            {formatARS(entry.payload.amount)} · {entry.payload.category}
            {entry.payload.note ? ` · ${entry.payload.note}` : ''}
          </p>
          {entry.status === 'pending' ? (
            <p className="font-label text-[10px] tracking-[0.14em] uppercase text-ritual-gray-text mt-1">
              Pendiente de sincronizar
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              <p role="alert" className="text-ritual-red-hover">
                No se pudo sincronizar: {entry.error}
              </p>
              <div className="flex gap-3">
                <Button type="button" variant="secondary" className="px-4 py-2" onClick={() => retry(entry.clientId)}>
                  Reintentar
                </Button>
                <Button type="button" variant="secondary" className="px-4 py-2" onClick={() => removeEntry(entry.clientId)}>
                  Descartar
                </Button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
```

`components/OutboxSync.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { useOutboxFlush } from '@/src/domains/expenses/offline/use-outbox'
import { warmOfflineRoutes } from '@/src/domains/expenses/offline/warm-cache'

/**
 * Mounted once for signed-in users. Drains the outbox whenever there is a
 * reason to think the network is back: app open, the `online` event, or the
 * tab becoming visible again. This is the sync path for iOS too, which has
 * no Background Sync.
 */
export function OutboxSync() {
  const flush = useOutboxFlush()

  useEffect(() => {
    const tryFlush = () => {
      if (navigator.onLine !== false) void flush().catch(() => {})
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') tryFlush()
    }

    tryFlush()
    void warmOfflineRoutes()
    // Ask the browser not to evict the outbox under storage pressure.
    void navigator.storage?.persist?.()

    window.addEventListener('online', tryFlush)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', tryFlush)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [flush])

  return null
}
```

- [ ] **Step 4: Export and mount**

Add to `src/domains/expenses/components/index.ts`:

```ts
export { PendingExpensesList } from './PendingExpensesList'
export { OutboxSync } from './OutboxSync'
```

`app/layout.tsx`: extend the existing import `import { OutboxSync } from "@/src/domains/expenses/components";` and render `{user && <OutboxSync />}` as the first child inside `<GraphQLProvider>` (it needs urql's context).

Render the list:
- `app/expenses/nuevo/page.tsx`: add `import { ExpenseForm, PendingExpensesList } from '@/src/domains/expenses/components'` and render `<div className="mt-8 max-w-xl"><PendingExpensesList /></div>` after `<ExpenseForm events={events} />` (wrap both siblings in the existing `PageShell` children as a fragment).
- `app/expenses/page.tsx`: read the file, and add `<PendingExpensesList />` as the first element inside `<PageShell>`.
- `EventExpensesPanel.tsx`: render `<PendingExpensesList eventId={eventId} />` right below the total/actions header block.

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src app`
Expected: PASS across the suite (page/layout tests included), no type or lint errors. If an existing page/layout test now fails because `OutboxSync` needs urql, mock it in that test with `vi.mock('@/src/domains/expenses/components', ...)` mirroring how the file already mocks siblings.

- [ ] **Step 6: Commit**

```bash
git add src/domains/expenses app/layout.tsx app/expenses
git commit -m "feat(expenses): show pending offline expenses and sync when back online"
```

---

# PR 4 — PWA shell

### Task 7: Manifest, icons, Serwist service worker, offline fallback

**Files:**
- Modify: `package.json`, `tsconfig.json`, `proxy.ts`, `app/layout.tsx`
- Create: `app/serwist/[path]/route.ts`, `app/sw.ts`, `app/manifest.ts`, `app/~offline/page.tsx`
- Create: `src/core/components/pwa/PwaProvider.tsx`
- Create: `scripts/generate-pwa-icons.mjs`, `public/icons/*.png` (generated)
- Test: `proxy.test.ts` if one exists (`fd proxy.test`), else a small matcher test below

**Interfaces:**
- Consumes: `OFFLINE_ROUTES` (Task 6) — routes the worker must serve offline.
- Produces: an installable PWA whose service worker is served at `/serwist/sw.js` with scope `/`.

- [ ] **Step 1: Install and verify the API surface**

Run: `npm i -D @serwist/turbopack serwist esbuild`

Then confirm the exports this task relies on exist in the installed version:

```bash
bat --style=plain node_modules/@serwist/turbopack/package.json | rg -n '"\./(worker|react)"'
rg -n "disable|swUrl" node_modules/@serwist/turbopack/dist/index.react.d.ts
```

Expected: `./worker` and `./react` entries present; `swUrl` documented. If `./worker` is missing, import `defaultCache` from wherever `rg -n "defaultCache" node_modules/@serwist/turbopack/dist -l` points. `PwaProvider` below does not depend on a `disable` prop.

- [ ] **Step 2: Write the proxy matcher test**

Auth middleware must not run on the service worker or manifest. Create `proxy.matcher.test.ts` at the repo root:

```ts
import { describe, it, expect } from 'vitest'
import { config } from './proxy'

const matcher = new RegExp(`^${config.matcher[0]}$`)

describe('proxy matcher', () => {
  it.each(['/serwist/sw.js', '/serwist/sw.js.map', '/manifest.webmanifest', '/icons/icon-192.png'])(
    'skips %s',
    (path) => {
      expect(matcher.test(path)).toBe(false)
    }
  )

  it.each(['/', '/expenses/nuevo', '/api/graphql', '/~offline'])('still guards %s', (path) => {
    expect(matcher.test(path)).toBe(true)
  })
})
```

Run: `npx vitest run proxy.matcher.test.ts`
Expected: FAIL for `/serwist/sw.js` and `/manifest.webmanifest` (currently matched).

- [ ] **Step 3: Update the matcher**

In `proxy.ts`, replace the matcher pattern with:

```ts
        '/((?!_next/static|_next/image|favicon.ico|serwist|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
```

and extend the comment above it with `- serwist (service worker) and manifest.webmanifest (no session needed)`.

Run: `npx vitest run proxy.matcher.test.ts`
Expected: PASS.

- [ ] **Step 4: Service worker route and source**

`app/serwist/[path]/route.ts`:

```ts
import { createSerwistRoute } from '@serwist/turbopack'

// Revision versions the precached offline fallback so a new deploy replaces it.
// `||` (not `??`): outside a git checkout the env var is simply unset.
const revision = process.env.VERCEL_GIT_COMMIT_SHA || crypto.randomUUID()

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [{ url: '/~offline', revision }],
  swSrc: 'app/sw.ts',
  useNativeEsbuild: true,
})
```

`app/sw.ts`:

```ts
import { defaultCache } from '@serwist/turbopack/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
})

// A page that isn't cached and can't be fetched (offline, first visit) falls
// back to a plain "sin conexión" page instead of the browser's dino.
serwist.setCatchHandler(async ({ request }) => {
  if (request.destination === 'document') {
    const fallback = await serwist.matchPrecache('/~offline')
    if (fallback) return fallback
  }
  return Response.error()
})

serwist.addEventListeners()
```

`app/~offline/page.tsx`:

```tsx
export const metadata = { title: 'Sin conexión | RITUAL' }

export default function OfflinePage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center text-ritual-bone">
      <h1 className="font-display text-4xl">Sin conexión</h1>
      <p className="font-body text-sm text-ritual-gray-text mt-4">
        Esta pantalla todavía no está disponible sin señal. Los gastos que cargues desde
        &ldquo;Nuevo gasto&rdquo; se guardan en tu dispositivo y se sincronizan cuando vuelva la conexión.
      </p>
    </main>
  )
}
```

`tsconfig.json`: add `"webworker"` to `compilerOptions.lib` (e.g. `["dom", "dom.iterable", "esnext", "webworker"]`). Then run `npx tsc --noEmit`. If `app/sw.ts` (or DOM/webworker lib conflicts) produce errors, revert the `lib` change and instead add `"app/sw.ts"` to the `exclude` array — the worker is compiled by esbuild, not by `tsc`.

- [ ] **Step 5: Provider, manifest and icons**

`src/core/components/pwa/PwaProvider.tsx`:

```tsx
'use client'

import { SerwistProvider } from '@serwist/turbopack/react'

/**
 * Registers the service worker in production only: in `next dev` a worker
 * serving cached pages hides the changes you're trying to see.
 */
export function PwaProvider({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== 'production') return <>{children}</>
  return <SerwistProvider swUrl="/serwist/sw.js">{children}</SerwistProvider>
}
```

`app/layout.tsx`: wrap the existing `<GraphQLProvider>...</GraphQLProvider>` in `<PwaProvider>` (import from `@/src/core/components/pwa/PwaProvider`), and extend `metadata` with:

```ts
  applicationName: "RITUAL",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "RITUAL" },
  icons: { apple: "/icons/apple-touch-icon.png" },
```

`app/manifest.ts` (read the dark background token first: `rg -n "ritual-(black|bg)|--color-ritual" app/globals.css | head`, and use that hex for both colors below instead of `#0a0a0a` if it differs):

```ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RITUAL',
    short_name: 'RITUAL',
    description: 'Tu agenda de recitales',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
```

`scripts/generate-pwa-icons.mjs` (placeholder artwork — replace the PNGs with real brand icons when available):

```js
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const BG = '#0a0a0a'
const FG = '#f2ede4'

const svg = (size, padding) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="100%" height="100%" fill="${BG}"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
        font-family="Arial Black, sans-serif" font-weight="900"
        font-size="${Math.round((size - padding * 2) * 0.62)}" fill="${FG}">R</text>
</svg>`

const targets = [
  ['icon-192.png', 192, 12],
  ['icon-512.png', 512, 32],
  // Maskable icons need a larger safe zone: the OS crops the edges.
  ['icon-maskable-512.png', 512, 96],
  ['apple-touch-icon.png', 180, 12],
]

await mkdir('public/icons', { recursive: true })
for (const [file, size, padding] of targets) {
  await sharp(Buffer.from(svg(size, padding))).png().toFile(`public/icons/${file}`)
  console.log('wrote', file)
}
```

Run: `node scripts/generate-pwa-icons.mjs` (if `sharp` isn't resolvable, run `npm i -D sharp` first).
Expected: four `wrote ...` lines and four PNGs under `public/icons/`.

- [ ] **Step 6: Verify the build serves a worker**

Run: `npm run build && npx tsc --noEmit && npx eslint app src && npx vitest run`
Expected: build succeeds; all checks pass.

Run `npm run start` in one shell, then: `curl -sI http://localhost:3000/serwist/sw.js | rg -i "content-type|service-worker-allowed"` and `curl -s http://localhost:3000/manifest.webmanifest | head -c 200`
Expected: JavaScript content type (and `Service-Worker-Allowed: /` if the package sets it — Task 8's E2E asserts the effective scope); the manifest JSON includes `"display":"standalone"`. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json proxy.ts proxy.matcher.test.ts app scripts public/icons src/core/components/pwa
git commit -m "feat(pwa): add manifest, icons and Serwist service worker"
```

### Task 8: Offline E2E and ADR

**Files:**
- Create: `playwright.pwa.config.ts`, `e2e/pwa/offline-expenses.spec.ts`
- Modify: `playwright.config.ts` (ignore `e2e/pwa`), `package.json` (script)
- Create: `docs/adr/0005-offline-expense-outbox.md` and add its line to `docs/adr/README.md` (read the README first and follow its index format)

**Interfaces:**
- Consumes: everything above, against a production build.

- [ ] **Step 1: Config and script**

`playwright.pwa.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

/**
 * The service worker only registers in a production build, so the offline
 * tests run against `next build && next start`, not the dev server the main
 * config uses. Needs a dedicated test account:
 *   RITUAL_E2E_EMAIL / RITUAL_E2E_PASSWORD
 */
export default defineConfig({
  testDir: './e2e/pwa',
  timeout: 120_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3100', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run start -- -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 600_000,
  },
})
```

In `playwright.config.ts` add `testIgnore: '**/pwa/**',` next to `testDir`. In `package.json` scripts add `"test:e2e:pwa": "playwright test -c playwright.pwa.config.ts"`.

- [ ] **Step 2: Write the E2E test**

`e2e/pwa/offline-expenses.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

const email = process.env.RITUAL_E2E_EMAIL
const password = process.env.RITUAL_E2E_PASSWORD

test.skip(!email || !password, 'Set RITUAL_E2E_EMAIL and RITUAL_E2E_PASSWORD (a dedicated test account)')

test('an expense created offline syncs exactly once when signal returns', async ({ page, context }) => {
  // 1. Sign in online.
  await page.goto('/login')
  await page.locator('#email').fill(email!)
  await page.locator('#password').fill(password!)
  await page.locator('button[type=submit]').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))

  // 2. Let the service worker take control and cache the expense form.
  await page.goto('/expenses/nuevo')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true)
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope)
  expect(scope).toBe('http://localhost:3100/')
  // Give the cache warm-up (OutboxSync) a moment to finish its fetches.
  await page.waitForLoadState('networkidle')

  // 3. Go offline and cold-reload: the form must still open.
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByLabel(/Monto/)).toBeVisible()

  // 4. Add an expense offline.
  const note = `e2e-offline-${Date.now()}`
  await page.getByLabel(/Monto/).fill('123')
  await page.getByLabel(/Categoría/).selectOption('Entrada')
  await page.getByLabel('Nota').fill(note)
  await page.getByRole('button', { name: 'Agregar gasto' }).click()
  await expect(page.getByText(/Guardado en tu dispositivo/)).toBeVisible()
  await expect(page.getByText('Pendiente de sincronizar')).toBeVisible()

  // 5. Back online: it syncs, and the create request is sent exactly once.
  const creates: string[] = []
  page.on('request', (req) => {
    const body = req.postData() ?? ''
    if (req.url().endsWith('/api/graphql') && body.includes('createExpense')) creates.push(body)
  })
  await context.setOffline(false)
  await expect(page.getByText('Pendiente de sincronizar')).toHaveCount(0, { timeout: 15_000 })
  expect(creates).toHaveLength(1)

  // 6. It really landed on the server.
  await page.goto('/expenses')
  await expect(page.getByText(note)).toHaveCount(1)
})
```

- [ ] **Step 3: Run it**

Run (with the account exported): `npm run test:e2e:pwa`
Expected: PASS. Without the env vars: the test is skipped, exit code 0.

If step 3 (`Monto` visible after the offline reload) fails, inspect what the worker cached: in the browser DevTools → Application → Cache Storage, check that entries for `/expenses/nuevo` exist. If the warm-up fetches didn't populate a document entry, change `warmOfflineRoutes` to fetch with `{ headers: { Accept: 'text/html' } }` and re-run; this is the one assumption in the design that only a real browser can settle.

- [ ] **Step 4: Write the ADR**

`docs/adr/0005-offline-expense-outbox.md`:

```markdown
# 5. Offline expense entry: Serwist + a hand-written outbox

Status: accepted (issue #10)

## Context

Expenses are logged on the spot at the venue, where signal is poor or absent.
Creating an expense must work offline and sync later, on Android and iOS.

## Decision

- A PWA with a Serwist service worker (`@serwist/turbopack`) caches the app and
  the expense form so the installed app cold-starts offline.
- Expense creation goes through an IndexedDB outbox that is written *before*
  the network call; a client-driven flusher (mount, `online`, `visibilitychange`)
  drains it through the existing `createExpense` GraphQL mutation.
- The server is idempotent: `expenses.client_id` with a unique
  `(user_id, client_id)` index; a retried create returns the existing row.
- Scope is create-only. The queue is append-only, so cross-device conflicts do
  not arise (expenses are per-user).

## Alternatives rejected

- **RxDB / PouchDB (full local-first replication):** overkill for append-only
  inserts; needs a replication endpoint and adds significant bundle weight.
- **Background Sync API:** not available on iOS Safari, so a client-driven
  flush is needed anyway; it would only be an Android-only extra.
- **Hand-rolled service worker:** precaching hashed Next.js chunks by hand is
  fragile across deploys.

## Consequences

- Offline edit/delete, attendance and notes are follow-ups; the outbox can be
  generalized to carry other mutation types.
- Entries the server rejects surface as `failed` and need a user decision.
- Cached authenticated pages live on the device until the browser evicts them.
```

Add its entry to `docs/adr/README.md` following the existing list format.

- [ ] **Step 5: Full verification and commit**

Run: `npx vitest run && npx tsc --noEmit && npx eslint . && npm run build`
Expected: all green.

```bash
git add playwright.pwa.config.ts playwright.config.ts package.json e2e/pwa docs/adr
git commit -m "test(pwa): add offline expense E2E and record the design in an ADR"
```

---

## Execution notes (deviations from the plan as written)

- **Owner scoping (security).** A commit security review flagged that the outbox lives on the device while the flusher sends under whoever is signed in, so a second user on the same phone would flush the first user's queued expenses into their own account. Fixed in `026812e`: `OutboxEntry.ownerId`, `enqueue(payload, ownerId)`, `listEntries(ownerId)`, `flushOutbox(send, ownerId)`, a module-level `outbox-owner.ts` set by `<OutboxSync userId />` from the layout's verified user, and no queueing when no owner is known. Task 6 was executed with this design (the `OutboxSync`/`usePendingExpenses`/`useOutboxFlush` snippets above predate it).
- **`PwaProvider`** uses the provider's own `disable` prop and sets `reloadOnOnline={false}` (its default reloads the page when signal returns, which would wipe a half-filled form).
- **tsconfig:** adding `"webworker"` to `lib` type-checks cleanly, so the `exclude` fallback was not needed.
- **Manifest/icons** use the app's real tokens (`#08080A` background, `#EDEBE6` foreground) instead of the placeholder hex values.
- **Tests:** the "quick-add inserts" panel test now awaits the UI (`findByText`), because the create path awaits the outbox (IndexedDB) before reporting success.
- **ADR 0005** is written in Spanish to match the existing ADRs.
- **Not run:** the Playwright E2E (Task 8) needs a dedicated Supabase test account (`RITUAL_E2E_EMAIL`/`RITUAL_E2E_PASSWORD`), so cold-start offline caching is still unverified in a real browser (see risk 1).

## Known risks (verify during implementation, not assumptions)

1. **Cold-start caching of authenticated pages** is proven only by Task 8's E2E; the warm-up fetch approach may need the `Accept` header tweak described there.
2. **Service worker scope**: `/serwist/sw.js` must control `/`; the E2E asserts the effective scope.
3. **Shared devices**: cached authenticated HTML stays until eviction. Clearing caches on sign-out is a candidate follow-up if this matters.
4. **`fake-indexeddb` vs `structuredClone`**: if a Vitest failure mentions cloning errors, upgrade `fake-indexeddb` before changing the outbox.
5. **Spec deviation — expired-session prompt.** The spec says an expired session should show "Iniciá sesión para sincronizar". This plan keeps those entries `pending` and flushes them after sign-in (nothing is lost), but the UI shows only the generic "Pendiente de sincronizar". A dedicated prompt needs the flusher to report `kind: 'auth'` to the UI (e.g. `authRequired` on `FlushSummary` plus a banner in `PendingExpensesList`); left out to keep PR 3 under ~400 lines. Add it as a follow-up task if wanted.
