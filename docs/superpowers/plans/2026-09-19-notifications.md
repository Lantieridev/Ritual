# Notifications + Internal Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Ritual notify a user outside the app (in-app inbox + transactional email) for post-show reminders and admin messages, with per-type, per-channel opt-out.

**Architecture:** The database is the queue. Producers call `notify()`, which reads preferences and inserts a row into `notifications` (that row *is* the inbox entry and the email job). A daily Vercel cron drains rows with `email_status = 'pending'` through an `EmailSender` (Resend); urgent messages also attempt delivery right away via `after()`. A second daily cron builds the post-show reminder using the existing pure `computePendingForShow`.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + RLS + pgTAP), Pothos GraphQL + urql, Vitest + Testing Library, Resend over plain `fetch` (no new dependency).

**Spec:** `docs/superpowers/specs/2026-09-19-notifications-design.md`

## Global Constraints

- Code, identifiers and comments in English; user-facing UI copy and email copy in Spanish (the app is Spanish; existing UI strings are Spanish).
- Commits: conventional commits, no `Co-Authored-By` or AI attribution lines (user rule in `~/.claude/CLAUDE.md`).
- Shell: use `bat`/`rg`/`fd`/`sd`/`eza`, never `cat`/`grep`/`find`/`sed`/`ls`.
- Server-only modules start with `import 'server-only'` (the global `vitest.setup.ts` mocks it).
- `notify()` never throws to its caller; failures are logged with `console.error` (the repo does not use Sentry `captureException` directly).
- Email delivery is capped at 3 attempts per notification (`MAX_EMAIL_ATTEMPTS = 3`).
- No insert into `notifications` from the client: only service-role code writes rows.
- Vercel Hobby crons fire once a day, "anywhere within the scheduled hour": schedule the drain cron in the hour *after* the producer cron, never the same hour.
- Env vars (all optional at build time, fail closed at run time): `RESEND_API_KEY`, `NOTIFICATIONS_FROM_EMAIL`. Existing: `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- v1 notification types: `moderation_rejected`, `post_show_reminder`, `admin_message`. **No producer is wired for `moderation_rejected`** (moderation has no reject flow yet; tracked in a follow-up issue, see Task 9).
- Run the full suite with `npm test`; a single file with `npx vitest run <path>`; pgTAP files with `npx supabase test db` (needs the local Supabase stack).

## File Structure

| File | Responsibility |
| --- | --- |
| `supabase/migrations/20260919000000_notifications.sql` | Tables, enums, RLS, grants, indexes, `claim_pending_notifications` RPC |
| `supabase/tests/notifications_rls.test.sql` | pgTAP: RLS, column grants, dedupe index, claim RPC |
| `src/domains/notifications/types.ts` | `NotificationType`, labels, `resolveChannels` |
| `src/domains/notifications/notify.ts` | The single producer entry point |
| `src/domains/notifications/email/types.ts` | `EmailSender`, `EmailMessage` |
| `src/domains/notifications/email/resend.ts` | Resend implementation over `fetch` |
| `src/domains/notifications/email/render.ts` | Notification → email subject/text/html |
| `src/domains/notifications/jobs/deliverNotifications.ts` | Claim + send + record outcome |
| `src/domains/notifications/jobs/notifyPostShow.ts` | Build post-show reminders |
| `src/domains/notifications/data.ts` | User-scoped reads/writes (cookie client, RLS) |
| `src/domains/notifications/service.ts` | Use cases derived from the signed-in user |
| `src/domains/notifications/adminMessage.ts` | `sendAdminMessage` (service-role + `after()`) |
| `src/domains/notifications/components/*` | Bell, list, mark-all-read, preferences form |
| `src/core/lib/supabase/service.ts` | `createServiceClient()` (service-role) |
| `src/graphql/notifications.ts` | Queries + mutations |
| `app/api/cron/notify-post-show/route.ts` | Producer cron |
| `app/api/cron/deliver-notifications/route.ts` | Drain cron |
| `app/notificaciones/page.tsx`, `app/notificaciones/ajustes/page.tsx` | Inbox and settings screens |

---

### Task 1: Migration and RLS tests

**Files:**
- Create: `supabase/migrations/20260919000000_notifications.sql`
- Test: `supabase/tests/notifications_rls.test.sql`

**Interfaces:**
- Produces: tables `public.notifications`, `public.notification_preferences`; enums `notification_type`, `notification_email_status`; RPC `public.claim_pending_notifications(batch_size int, only_ids uuid[] default null) returns setof public.notifications` (service-role only). Columns used by later tasks: `id, user_id, type, title, body, payload, dedupe_key, read_at, in_app, email_status, email_attempts, email_last_error, email_sent_at, email_claimed_at, created_at`; preferences: `user_id, type, in_app, email, updated_at`.

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/notifications_rls.test.sql`:

```sql
-- notifications: el inbox y la cola de email. El cliente sólo lee sus filas
-- visibles (in_app) y sólo puede tocar read_at; nadie inserta desde el cliente.
-- notification_preferences: privadas por dueño.
begin;
select plan(14);

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

-- Filas sembradas como superusuario (equivale a service-role).
insert into public.notifications (id, user_id, type, title, body, dedupe_key, in_app, email_status)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'admin_message', 'Hola', 'Cuerpo', null, true, 'pending'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'post_show_reminder', 'Oculta', 'Sólo email', 'post_show:e1', false, 'pending'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'admin_message', 'Ajena', 'Cuerpo', null, true, 'skipped');

select has_table('public', 'notifications', 'la tabla notifications existe');
select has_table('public', 'notification_preferences', 'la tabla notification_preferences existe');

-- ─── dedupe ─────────────────────────────────────────────────────────────────
select throws_ok(
  $$insert into public.notifications (user_id, type, title, body, dedupe_key)
    values ('11111111-1111-1111-1111-111111111111', 'post_show_reminder', 'Dup', 'Dup', 'post_show:e1')$$,
  '23505',
  null,
  'el mismo (user_id, dedupe_key) no se puede insertar dos veces'
);

-- ─── el dueño ve sólo sus filas in_app ──────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is(
  (select count(*) from public.notifications)::int,
  1,
  'el dueño ve sólo su fila in_app (no la de sólo-email ni la ajena)'
);

update public.notifications set read_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select isnt(
  (select read_at from public.notifications where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  null,
  'el dueño puede marcar como leída su fila'
);

select throws_ok(
  $$update public.notifications set title = 'Hackeado' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'el dueño no puede editar columnas que no sean read_at'
);

select throws_ok(
  $$insert into public.notifications (user_id, type, title, body)
    values ('11111111-1111-1111-1111-111111111111', 'admin_message', 'Propia', 'x')$$,
  '42501',
  null,
  'el cliente no puede insertar notificaciones'
);

-- ─── preferencias: dueño sí, ajeno no ───────────────────────────────────────
insert into public.notification_preferences (user_id, type, in_app, email)
values ('11111111-1111-1111-1111-111111111111', 'admin_message', true, false);

select is(
  (select email from public.notification_preferences where user_id = '11111111-1111-1111-1111-111111111111' and type = 'admin_message'),
  false,
  'el dueño guarda y lee su preferencia'
);

select throws_ok(
  $$insert into public.notification_preferences (user_id, type, in_app, email)
    values ('22222222-2222-2222-2222-222222222222', 'admin_message', true, true)$$,
  '42501',
  null,
  'un usuario no puede escribir preferencias de otro'
);

reset role;

-- ─── otro usuario no ve la fila ajena ───────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is(
  (select count(*) from public.notifications where user_id = '11111111-1111-1111-1111-111111111111')::int,
  0,
  'otro usuario no lee notificaciones ajenas'
);

select is(
  (select count(*) from public.notification_preferences where user_id = '11111111-1111-1111-1111-111111111111')::int,
  0,
  'otro usuario no lee preferencias ajenas'
);

reset role;

-- ─── claim_pending_notifications ────────────────────────────────────────────
select is(
  (select count(*) from public.claim_pending_notifications(10))::int,
  2,
  'claim toma las 2 filas pending (una in_app, una sólo-email)'
);

select is(
  (select email_attempts from public.notifications where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1::smallint,
  'claim incrementa email_attempts'
);

select is(
  (select count(*) from public.claim_pending_notifications(10))::int,
  0,
  'una segunda corrida no re-toma filas recién reclamadas'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx supabase test db`
Expected: FAIL — `relation "public.notifications" does not exist` (or `has_table` failures).

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260919000000_notifications.sql`:

```sql
-- Sistema de notificaciones (issue #6).
--
-- `notifications` es a la vez el inbox in-app y la cola de emails: un
-- productor inserta una fila; el cron `deliver-notifications` drena las que
-- tienen email_status = 'pending'. Sólo el servidor (service-role) inserta.

create type public.notification_type as enum (
  'moderation_rejected',
  'post_show_reminder',
  'admin_message'
);

create type public.notification_email_status as enum (
  'skipped',
  'pending',
  'sent',
  'failed'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.notification_type not null,
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 2000),
  payload jsonb not null default '{}'::jsonb,
  -- Un reintento del cron no debe duplicar el aviso (ej. 'post_show:{event_id}').
  dedupe_key text,
  read_at timestamptz,
  -- false = la fila existe sólo como cola de email y no aparece en el inbox.
  in_app boolean not null default true,
  email_status public.notification_email_status not null default 'skipped',
  email_attempts smallint not null default 0,
  email_last_error text,
  email_sent_at timestamptz,
  -- Lo setea claim_pending_notifications; evita que dos corridas tomen la misma fila.
  email_claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index notifications_dedupe_idx
  on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

create index notifications_inbox_idx
  on public.notifications (user_id, created_at desc)
  where in_app;

create index notifications_email_pending_idx
  on public.notifications (created_at)
  where email_status = 'pending';

alter table public.notifications enable row level security;

create policy "Owner reads own visible notifications" on public.notifications
  for select to authenticated
  using ((select auth.uid()) = user_id and in_app);

create policy "Owner marks own notifications read" on public.notifications
  for update to authenticated
  using ((select auth.uid()) = user_id and in_app)
  with check ((select auth.uid()) = user_id);

-- Column-level: el dueño sólo puede tocar read_at, no el contenido ni la cola.
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create table public.notification_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.notification_type not null,
  in_app boolean not null default true,
  email boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, type)
);

alter table public.notification_preferences enable row level security;

create policy "Owner manages own notification_preferences" on public.notification_preferences
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.notification_preferences from anon;

-- Toma un lote de emails pendientes de forma atómica. `for update skip locked`
-- protege de dos corridas superpuestas; email_claimed_at evita re-tomar filas
-- que otra corrida está enviando (se considera colgada tras 10 minutos).
create function public.claim_pending_notifications(
  batch_size int,
  only_ids uuid[] default null
)
returns setof public.notifications
language sql
security definer
set search_path = public
as $$
  update public.notifications n
  set email_attempts = n.email_attempts + 1,
      email_claimed_at = now()
  where n.id in (
    select id
    from public.notifications
    where email_status = 'pending'
      and email_attempts < 3
      and (email_claimed_at is null or email_claimed_at < now() - interval '10 minutes')
      and (only_ids is null or id = any (only_ids))
    order by created_at
    limit batch_size
    for update skip locked
  )
  returning n.*;
$$;

revoke execute on function public.claim_pending_notifications(int, uuid[]) from public, anon, authenticated;
grant execute on function public.claim_pending_notifications(int, uuid[]) to service_role;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx supabase db reset && npx supabase test db`
Expected: PASS, all 14 assertions of `notifications_rls.test.sql` OK.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260919000000_notifications.sql supabase/tests/notifications_rls.test.sql
git commit -m "feat(notifications): add notifications and preferences tables with RLS"
```

---

### Task 2: Types, labels and channel resolution

**Files:**
- Create: `src/domains/notifications/types.ts`
- Test: `src/domains/notifications/types.test.ts`

**Interfaces:**
- Produces:
  - `NOTIFICATION_TYPES: readonly ['moderation_rejected','post_show_reminder','admin_message']`
  - `type NotificationType`
  - `interface ChannelPreference { inApp: boolean; email: boolean }`
  - `DEFAULT_CHANNELS: ChannelPreference` (`{ inApp: true, email: true }`)
  - `NOTIFICATION_TYPE_LABELS: Record<NotificationType, { label: string; description: string }>`
  - `isNotificationType(value: string): value is NotificationType`
  - `resolveChannels(row: { in_app: boolean; email: boolean } | null | undefined): ChannelPreference`

- [ ] **Step 1: Write the failing test**

Create `src/domains/notifications/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
    NOTIFICATION_TYPES,
    NOTIFICATION_TYPE_LABELS,
    DEFAULT_CHANNELS,
    isNotificationType,
    resolveChannels,
} from './types'

describe('notification types', () => {
    it('has a label and description for every type', () => {
        for (const type of NOTIFICATION_TYPES) {
            expect(NOTIFICATION_TYPE_LABELS[type].label.length).toBeGreaterThan(0)
            expect(NOTIFICATION_TYPE_LABELS[type].description.length).toBeGreaterThan(0)
        }
    })

    it('recognises valid types and rejects anything else', () => {
        expect(isNotificationType('admin_message')).toBe(true)
        expect(isNotificationType('nope')).toBe(false)
    })
})

describe('resolveChannels', () => {
    it('falls back to both channels on when there is no preference row', () => {
        expect(resolveChannels(null)).toEqual(DEFAULT_CHANNELS)
        expect(resolveChannels(undefined)).toEqual(DEFAULT_CHANNELS)
    })

    it('maps the stored row to the channel preference', () => {
        expect(resolveChannels({ in_app: true, email: false })).toEqual({ inApp: true, email: false })
        expect(resolveChannels({ in_app: false, email: true })).toEqual({ inApp: false, email: true })
    })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/domains/notifications/types.test.ts`
Expected: FAIL — cannot resolve `./types`.

- [ ] **Step 3: Write the implementation**

Create `src/domains/notifications/types.ts`:

```ts
export const NOTIFICATION_TYPES = ['moderation_rejected', 'post_show_reminder', 'admin_message'] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export interface ChannelPreference {
    inApp: boolean
    email: boolean
}

/** Applies when the user never touched the setting: every channel on. */
export const DEFAULT_CHANNELS: ChannelPreference = { inApp: true, email: true }

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, { label: string; description: string }> = {
    moderation_rejected: {
        label: 'Entrada rechazada',
        description: 'Cuando un moderador rechaza algo que subiste, con el motivo.',
    },
    post_show_reminder: {
        label: 'Recordatorio post-show',
        description: 'Un solo aviso con todo lo que falta cargar de un show.',
    },
    admin_message: {
        label: 'Mensajes del equipo',
        description: 'Avisos directos de un administrador sobre tu cuenta.',
    },
}

export function isNotificationType(value: string): value is NotificationType {
    return (NOTIFICATION_TYPES as readonly string[]).includes(value)
}

export function resolveChannels(row: { in_app: boolean; email: boolean } | null | undefined): ChannelPreference {
    if (!row) return DEFAULT_CHANNELS
    return { inApp: row.in_app, email: row.email }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/domains/notifications/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/types.ts src/domains/notifications/types.test.ts
git commit -m "feat(notifications): add notification types and channel resolution"
```

---

### Task 3: `notify()` producer entry point

**Files:**
- Create: `src/domains/notifications/notify.ts`
- Test: `src/domains/notifications/notify.test.ts`

**Interfaces:**
- Consumes: `NotificationType`, `resolveChannels` from `./types`.
- Produces:
  - `interface NotifyInput { userId: string; type: NotificationType; title: string; body: string; payload?: Record<string, unknown>; dedupeKey?: string }`
  - `type NotifyOutcome = 'created' | 'duplicate' | 'suppressed' | 'failed'`
  - `notify(supabase: SupabaseClient, input: NotifyInput): Promise<{ outcome: NotifyOutcome; id?: string }>` — never throws.

- [ ] **Step 1: Write the failing test**

Create `src/domains/notifications/notify.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { notify } from './notify'

const maybeSingle = vi.fn()
const single = vi.fn()
const insert = vi.fn()

function makeSupabase() {
    return {
        from: (table: string) => {
            if (table === 'notification_preferences') {
                return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }) }
            }
            return { insert: (row: unknown) => { insert(row); return { select: () => ({ single }) } } }
        },
    } as unknown as SupabaseClient
}

const input = {
    userId: 'u1',
    type: 'admin_message' as const,
    title: 'Hola',
    body: 'Cuerpo',
    payload: { a: 1 },
    dedupeKey: 'k1',
}

describe('notify', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, 'error').mockImplementation(() => {})
        maybeSingle.mockResolvedValue({ data: null, error: null })
        single.mockResolvedValue({ data: { id: 'n1' }, error: null })
    })

    it('inserts with both channels on by default and marks email as pending', async () => {
        const result = await notify(makeSupabase(), input)

        expect(result).toEqual({ outcome: 'created', id: 'n1' })
        expect(insert).toHaveBeenCalledWith({
            user_id: 'u1',
            type: 'admin_message',
            title: 'Hola',
            body: 'Cuerpo',
            payload: { a: 1 },
            dedupe_key: 'k1',
            in_app: true,
            email_status: 'pending',
        })
    })

    it('skips email when the user turned it off', async () => {
        maybeSingle.mockResolvedValue({ data: { in_app: true, email: false }, error: null })

        await notify(makeSupabase(), input)

        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ in_app: true, email_status: 'skipped' }))
    })

    it('keeps the row as an email-only job when in-app is off', async () => {
        maybeSingle.mockResolvedValue({ data: { in_app: false, email: true }, error: null })

        await notify(makeSupabase(), input)

        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ in_app: false, email_status: 'pending' }))
    })

    it('inserts nothing when both channels are off', async () => {
        maybeSingle.mockResolvedValue({ data: { in_app: false, email: false }, error: null })

        const result = await notify(makeSupabase(), input)

        expect(result).toEqual({ outcome: 'suppressed' })
        expect(insert).not.toHaveBeenCalled()
    })

    it('reports a duplicate when the dedupe index rejects the insert', async () => {
        single.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } })

        expect(await notify(makeSupabase(), input)).toEqual({ outcome: 'duplicate' })
    })

    it('logs and returns failed on any other database error, without throwing', async () => {
        single.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } })

        expect(await notify(makeSupabase(), input)).toEqual({ outcome: 'failed' })
        expect(console.error).toHaveBeenCalled()
    })

    it('falls back to defaults when the preference read fails', async () => {
        maybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } })

        const result = await notify(makeSupabase(), input)

        expect(result.outcome).toBe('created')
    })

    it('never throws even when the client itself throws', async () => {
        const broken = { from: () => { throw new Error('network') } } as unknown as SupabaseClient

        expect(await notify(broken, input)).toEqual({ outcome: 'failed' })
    })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/domains/notifications/notify.test.ts`
Expected: FAIL — cannot resolve `./notify`.

- [ ] **Step 3: Write the implementation**

Create `src/domains/notifications/notify.ts`:

```ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveChannels, type NotificationType } from './types'

export interface NotifyInput {
    userId: string
    type: NotificationType
    title: string
    body: string
    payload?: Record<string, unknown>
    /** Same (userId, dedupeKey) is inserted at most once, so a retried cron never double-notifies. */
    dedupeKey?: string
}

export type NotifyOutcome = 'created' | 'duplicate' | 'suppressed' | 'failed'

const UNIQUE_VIOLATION = '23505'

/**
 * The single entry point every producer uses. Reads the user's per-type
 * preference, then inserts one row that is both the inbox entry and the email
 * job. Requires a service-role client: there is no insert policy for users.
 *
 * Never throws: losing a notification must not break the action that
 * triggered it (rejecting an entry, saving a rating, ...).
 */
export async function notify(
    supabase: SupabaseClient,
    input: NotifyInput
): Promise<{ outcome: NotifyOutcome; id?: string }> {
    try {
        const { data: prefRow, error: prefError } = await supabase
            .from('notification_preferences')
            .select('in_app, email')
            .eq('user_id', input.userId)
            .eq('type', input.type)
            .maybeSingle()
        // A failed preference read degrades to the defaults instead of dropping the notice.
        if (prefError) console.error('notify: could not read preferences, using defaults:', prefError)

        const channels = resolveChannels(prefError ? null : prefRow)
        if (!channels.inApp && !channels.email) return { outcome: 'suppressed' }

        const { data, error } = await supabase
            .from('notifications')
            .insert({
                user_id: input.userId,
                type: input.type,
                title: input.title,
                body: input.body,
                payload: input.payload ?? {},
                dedupe_key: input.dedupeKey ?? null,
                in_app: channels.inApp,
                email_status: channels.email ? 'pending' : 'skipped',
            })
            .select('id')
            .single()

        if (error) {
            if (error.code === UNIQUE_VIOLATION) return { outcome: 'duplicate' }
            console.error('notify: insert failed:', error)
            return { outcome: 'failed' }
        }
        return { outcome: 'created', id: data.id as string }
    } catch (error) {
        console.error('notify: unexpected failure:', error)
        return { outcome: 'failed' }
    }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/domains/notifications/notify.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/notify.ts src/domains/notifications/notify.test.ts
git commit -m "feat(notifications): add notify() producer entry point"
```

---

### Task 4: Email sender, renderer and env getters

**Files:**
- Create: `src/domains/notifications/email/types.ts`, `src/domains/notifications/email/resend.ts`, `src/domains/notifications/email/render.ts`
- Modify: `src/core/lib/env.ts` (add two getters after `getSpotifyClientSecret`)
- Test: `src/domains/notifications/email/resend.test.ts`, `src/domains/notifications/email/render.test.ts`

**Interfaces:**
- Produces:
  - `interface EmailMessage { to: string; subject: string; text: string; html: string }`
  - `interface EmailSender { send(message: EmailMessage): Promise<void> }` (throws on failure)
  - `createResendSender(apiKey: string, from: string, fetchImpl?: typeof fetch): EmailSender`
  - `renderNotificationEmail(input: { title: string; body: string; appUrl: string }): { subject: string; text: string; html: string }`
  - `getResendApiKey(): string | undefined`, `getNotificationsFromEmail(): string | undefined` in `env.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/domains/notifications/email/resend.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { createResendSender } from './resend'

const message = { to: 'a@b.com', subject: 'S', text: 'T', html: '<p>T</p>' }

describe('createResendSender', () => {
    it('posts the message to the Resend API with the bearer key', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(new Response('{"id":"x"}', { status: 200 }))

        await createResendSender('re_key', 'Ritual <avisos@ritual.app>', fetchImpl).send(message)

        expect(fetchImpl).toHaveBeenCalledWith('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: 'Bearer re_key', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: 'Ritual <avisos@ritual.app>',
                to: ['a@b.com'],
                subject: 'S',
                text: 'T',
                html: '<p>T</p>',
            }),
        })
    })

    it('throws with the status and a trimmed body on a non-2xx response', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(new Response('x'.repeat(500), { status: 422 }))

        const promise = createResendSender('k', 'f', fetchImpl).send(message)

        await expect(promise).rejects.toThrow(/^Resend 422: x{200}$/)
    })
})
```

Create `src/domains/notifications/email/render.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { renderNotificationEmail } from './render'

describe('renderNotificationEmail', () => {
    it('uses the title as subject and links to the inbox', () => {
        const email = renderNotificationEmail({ title: 'Te faltan datos', body: 'Puntuar el show', appUrl: 'https://ritual.app' })

        expect(email.subject).toBe('Te faltan datos')
        expect(email.text).toContain('Puntuar el show')
        expect(email.text).toContain('https://ritual.app/notificaciones')
        expect(email.html).toContain('href="https://ritual.app/notificaciones"')
    })

    it('escapes HTML in title and body', () => {
        const email = renderNotificationEmail({ title: '<b>x</b>', body: 'a & <script>', appUrl: 'https://ritual.app' })

        expect(email.html).not.toContain('<script>')
        expect(email.html).toContain('a &amp; &lt;script&gt;')
        expect(email.html).toContain('&lt;b&gt;x&lt;/b&gt;')
    })

    it('keeps line breaks of the body in the HTML version', () => {
        const email = renderNotificationEmail({ title: 't', body: 'uno\ndos', appUrl: 'https://ritual.app' })

        expect(email.html).toContain('uno<br>dos')
    })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/domains/notifications/email`
Expected: FAIL — cannot resolve `./resend` / `./render`.

- [ ] **Step 3: Write the implementation**

Create `src/domains/notifications/email/types.ts`:

```ts
export interface EmailMessage {
    to: string
    subject: string
    text: string
    html: string
}

/** Provider seam: tests inject a fake, swapping Resend for another provider touches one file. */
export interface EmailSender {
    /** Resolves on success, throws on any failure. */
    send(message: EmailMessage): Promise<void>
}
```

Create `src/domains/notifications/email/resend.ts`:

```ts
import type { EmailSender } from './types'

const RESEND_URL = 'https://api.resend.com/emails'
const ERROR_BODY_LIMIT = 200

export function createResendSender(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): EmailSender {
    return {
        async send(message) {
            const response = await fetchImpl(RESEND_URL, {
                method: 'POST',
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from,
                    to: [message.to],
                    subject: message.subject,
                    text: message.text,
                    html: message.html,
                }),
            })
            if (!response.ok) {
                const body = (await response.text()).slice(0, ERROR_BODY_LIMIT)
                throw new Error(`Resend ${response.status}: ${body}`)
            }
        },
    }
}
```

Create `src/domains/notifications/email/render.ts`:

```ts
function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export function renderNotificationEmail(input: { title: string; body: string; appUrl: string }) {
    const inboxUrl = `${input.appUrl.replace(/\/$/, '')}/notificaciones`
    const htmlBody = escapeHtml(input.body).replace(/\n/g, '<br>')

    return {
        subject: input.title,
        text: `${input.body}\n\nVer en Ritual: ${inboxUrl}`,
        html: [
            `<h2>${escapeHtml(input.title)}</h2>`,
            `<p>${htmlBody}</p>`,
            `<p><a href="${inboxUrl}">Ver en Ritual</a></p>`,
        ].join(''),
    }
}
```

Modify `src/core/lib/env.ts` — add after `getSpotifyClientSecret()`:

```ts
export function getResendApiKey(): string | undefined {
    return process.env.RESEND_API_KEY?.trim() || undefined
}

export function getNotificationsFromEmail(): string | undefined {
    return process.env.NOTIFICATIONS_FROM_EMAIL?.trim() || undefined
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/domains/notifications/email src/core/lib/env.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/email src/core/lib/env.ts
git commit -m "feat(notifications): add EmailSender seam with Resend implementation"
```

---

### Task 5: Delivery job, service client and `deliver-notifications` cron

**Files:**
- Create: `src/core/lib/supabase/service.ts`, `src/domains/notifications/jobs/deliverNotifications.ts`, `app/api/cron/deliver-notifications/route.ts`
- Modify: `vercel.json`
- Test: `src/domains/notifications/jobs/deliverNotifications.test.ts`, `app/api/cron/deliver-notifications/route.test.ts`

**Interfaces:**
- Consumes: `EmailSender`, `renderNotificationEmail`, `RUN_BUDGET_MS`, `CronSupabaseClient` from `@/src/core/lib/cron`; RPC `claim_pending_notifications`.
- Produces:
  - `createServiceClient(): SupabaseClient | null` (service-role, null when env is missing)
  - `MAX_EMAIL_ATTEMPTS = 3`
  - `deliverNotifications(supabase: CronSupabaseClient, sender: EmailSender, options?: { onlyIds?: string[]; batchSize?: number; appUrl?: string; runStart?: Date; budgetMs?: number; now?: () => number }): Promise<{ ok: boolean; details: { claimed: number; sent: number; retried: number; failed: number; stopped_reason?: 'deadline' } }>`

- [ ] **Step 1: Write the failing tests**

Create `src/domains/notifications/jobs/deliverNotifications.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CronSupabaseClient } from '@/src/core/lib/cron'
import type { EmailSender } from '../email/types'
import { deliverNotifications } from './deliverNotifications'

const rpc = vi.fn()
const getUserById = vi.fn()
const updateEq = vi.fn()
const update = vi.fn()

function makeSupabase() {
    return {
        rpc,
        auth: { admin: { getUserById } },
        from: () => ({ update: (patch: unknown) => { update(patch); return { eq: updateEq } } }),
    } as unknown as CronSupabaseClient
}

function row(overrides: Record<string, unknown> = {}) {
    return { id: 'n1', user_id: 'u1', title: 'Hola', body: 'Cuerpo', email_attempts: 1, ...overrides }
}

describe('deliverNotifications', () => {
    let sender: EmailSender

    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, 'error').mockImplementation(() => {})
        sender = { send: vi.fn().mockResolvedValue(undefined) }
        getUserById.mockResolvedValue({ data: { user: { email: 'a@b.com' } }, error: null })
        updateEq.mockResolvedValue({ error: null })
    })

    it('claims a batch, sends each email and marks the row sent', async () => {
        rpc.mockResolvedValue({ data: [row()], error: null })

        const result = await deliverNotifications(makeSupabase(), sender, { appUrl: 'https://ritual.app' })

        expect(rpc).toHaveBeenCalledWith('claim_pending_notifications', { batch_size: 50, only_ids: null })
        expect(sender.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@b.com', subject: 'Hola' }))
        expect(update).toHaveBeenCalledWith(expect.objectContaining({ email_status: 'sent', email_last_error: null }))
        expect(result).toEqual({ ok: true, details: { claimed: 1, sent: 1, retried: 0, failed: 0 } })
    })

    it('limits the claim to the given ids for immediate delivery', async () => {
        rpc.mockResolvedValue({ data: [], error: null })

        await deliverNotifications(makeSupabase(), sender, { onlyIds: ['n1'], appUrl: 'https://x' })

        expect(rpc).toHaveBeenCalledWith('claim_pending_notifications', { batch_size: 50, only_ids: ['n1'] })
    })

    it('keeps the row pending and releases the claim when a send fails before the attempt cap', async () => {
        rpc.mockResolvedValue({ data: [row({ email_attempts: 1 })], error: null })
        vi.mocked(sender.send).mockRejectedValue(new Error('Resend 500: down'))

        const result = await deliverNotifications(makeSupabase(), sender, { appUrl: 'https://x' })

        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({ email_status: 'pending', email_last_error: 'Resend 500: down', email_claimed_at: null })
        )
        expect(result.details).toMatchObject({ sent: 0, retried: 1, failed: 0 })
    })

    it('marks the row failed once the attempt cap is reached', async () => {
        rpc.mockResolvedValue({ data: [row({ email_attempts: 3 })], error: null })
        vi.mocked(sender.send).mockRejectedValue(new Error('still down'))

        const result = await deliverNotifications(makeSupabase(), sender, { appUrl: 'https://x' })

        expect(update).toHaveBeenCalledWith(expect.objectContaining({ email_status: 'failed' }))
        expect(result.details).toMatchObject({ retried: 0, failed: 1 })
    })

    it('fails the row for good when the user has no email address', async () => {
        rpc.mockResolvedValue({ data: [row()], error: null })
        getUserById.mockResolvedValue({ data: { user: { email: null } }, error: null })

        const result = await deliverNotifications(makeSupabase(), sender, { appUrl: 'https://x' })

        expect(sender.send).not.toHaveBeenCalled()
        expect(update).toHaveBeenCalledWith(expect.objectContaining({ email_status: 'failed', email_last_error: 'no_email' }))
        expect(result.details.failed).toBe(1)
    })

    it('reports not-ok when the claim itself fails', async () => {
        rpc.mockResolvedValue({ data: null, error: { message: 'rpc down' } })

        const result = await deliverNotifications(makeSupabase(), sender, { appUrl: 'https://x' })

        expect(result.ok).toBe(false)
        expect(sender.send).not.toHaveBeenCalled()
    })

    it('stops sending once the run budget is spent', async () => {
        rpc.mockResolvedValue({ data: [row({ id: 'n1' }), row({ id: 'n2' })], error: null })
        const now = vi.fn().mockReturnValueOnce(0).mockReturnValue(1_000)

        const result = await deliverNotifications(makeSupabase(), sender, {
            appUrl: 'https://x',
            runStart: new Date(0),
            budgetMs: 500,
            now,
        })

        expect(sender.send).toHaveBeenCalledTimes(1)
        expect(result.details.stopped_reason).toBe('deadline')
    })
})
```

Create `app/api/cron/deliver-notifications/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const insert = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({ from: (t: string) => (t === 'cron_runs' ? { insert } : {}) }),
}))

const deliverNotifications = vi.fn()
vi.mock('@/src/domains/notifications/jobs/deliverNotifications', () => ({
    deliverNotifications: (...args: unknown[]) => deliverNotifications(...args),
}))

import { GET } from './route'

function req(secret = 'test-secret') {
    return new Request('http://localhost/api/cron/deliver-notifications', {
        headers: { authorization: `Bearer ${secret}` },
    })
}

describe('GET /api/cron/deliver-notifications', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        insert.mockResolvedValue({ error: null })
        deliverNotifications.mockResolvedValue({ ok: true, details: { claimed: 2, sent: 2, retried: 0, failed: 0 } })
        vi.stubEnv('CRON_SECRET', 'test-secret')
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
        vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')
        vi.stubEnv('RESEND_API_KEY', 're_key')
        vi.stubEnv('NOTIFICATIONS_FROM_EMAIL', 'Ritual <avisos@ritual.app>')
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://ritual.app')
    })

    it('rejects a wrong bearer secret', async () => {
        expect((await GET(req('wrong'))).status).toBe(401)
    })

    it('fails closed with 503 when the email provider is not configured', async () => {
        vi.stubEnv('RESEND_API_KEY', '')

        const res = await GET(req())

        expect(res.status).toBe(503)
        expect(deliverNotifications).not.toHaveBeenCalled()
    })

    it('runs the delivery job and records the run', async () => {
        const res = await GET(req())

        expect(await res.json()).toEqual({ success: true, claimed: 2, sent: 2, retried: 0, failed: 0 })
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ job: 'deliver-notifications', ok: true }))
    })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/domains/notifications/jobs/deliverNotifications.test.ts app/api/cron/deliver-notifications`
Expected: FAIL — cannot resolve `./deliverNotifications` / `./route`.

- [ ] **Step 3: Write the implementation**

Create `src/core/lib/supabase/service.ts`:

```ts
import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * A service-role client for server code that acts on behalf of the system
 * (writing notifications, reading auth emails), not on behalf of the caller.
 * Null when the env isn't configured; the caller decides how to degrade.
 * Crons use `createCronSupabase` from `./cron`, which does the same for them.
 */
export function createServiceClient(): SupabaseClient | null {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
        console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para el cliente de servicio.')
        return null
    }
    return createClient(url, key)
}
```

Create `src/domains/notifications/jobs/deliverNotifications.ts`:

```ts
/**
 * Drains the email queue: claims pending notifications atomically, sends each
 * one and records the outcome. A failed send stays `pending` (and is retried by
 * the next run) until MAX_EMAIL_ATTEMPTS, then becomes `failed`. The in-app
 * inbox is unaffected either way.
 */
import 'server-only'
import { RUN_BUDGET_MS, type CronSupabaseClient } from '@/src/core/lib/cron'
import type { EmailSender } from '../email/types'
import { renderNotificationEmail } from '../email/render'

export const MAX_EMAIL_ATTEMPTS = 3
const DEFAULT_BATCH_SIZE = 50

export interface DeliverNotificationsDetails {
    claimed: number
    sent: number
    retried: number
    failed: number
    stopped_reason?: 'deadline'
}

export interface DeliverNotificationsOptions {
    /** Immediate delivery of specific rows (used by `after()`); omitted for the daily drain. */
    onlyIds?: string[]
    batchSize?: number
    appUrl?: string
    runStart?: Date
    budgetMs?: number
    now?: () => number
}

interface ClaimedRow {
    id: string
    user_id: string
    title: string
    body: string
    email_attempts: number
}

export async function deliverNotifications(
    supabase: CronSupabaseClient,
    sender: EmailSender,
    options: DeliverNotificationsOptions = {}
): Promise<{ ok: boolean; details: DeliverNotificationsDetails }> {
    const details: DeliverNotificationsDetails = { claimed: 0, sent: 0, retried: 0, failed: 0 }
    const now = options.now ?? Date.now
    const runStart = options.runStart ?? new Date(now())
    const budgetMs = options.budgetMs ?? RUN_BUDGET_MS
    const appUrl = options.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? ''

    const { data, error } = await supabase.rpc('claim_pending_notifications', {
        batch_size: options.batchSize ?? DEFAULT_BATCH_SIZE,
        only_ids: options.onlyIds ?? null,
    })
    if (error) {
        console.error('deliverNotifications: claim failed:', error)
        return { ok: false, details }
    }

    const rows = (data ?? []) as ClaimedRow[]
    details.claimed = rows.length

    for (const row of rows) {
        if (now() - runStart.getTime() >= budgetMs) {
            details.stopped_reason = 'deadline'
            break
        }
        await deliverRow(supabase, sender, row, appUrl, details)
    }

    return { ok: true, details }
}

async function deliverRow(
    supabase: CronSupabaseClient,
    sender: EmailSender,
    row: ClaimedRow,
    appUrl: string,
    details: DeliverNotificationsDetails
): Promise<void> {
    const { data: userData } = await supabase.auth.admin.getUserById(row.user_id)
    const to = userData?.user?.email
    if (!to) {
        await record(supabase, row.id, { email_status: 'failed', email_last_error: 'no_email' })
        details.failed++
        return
    }

    try {
        await sender.send({ to, ...renderNotificationEmail({ title: row.title, body: row.body, appUrl }) })
        await record(supabase, row.id, {
            email_status: 'sent',
            email_sent_at: new Date().toISOString(),
            email_last_error: null,
        })
        details.sent++
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const exhausted = row.email_attempts >= MAX_EMAIL_ATTEMPTS
        await record(supabase, row.id, {
            email_status: exhausted ? 'failed' : 'pending',
            email_last_error: message,
            email_claimed_at: null,
        })
        if (exhausted) details.failed++
        else details.retried++
    }
}

async function record(supabase: CronSupabaseClient, id: string, patch: Record<string, unknown>): Promise<void> {
    const { error } = await supabase.from('notifications').update(patch).eq('id', id)
    if (error) console.error('deliverNotifications: could not record outcome:', error)
}
```

Create `app/api/cron/deliver-notifications/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { authorizeCron, createCronSupabase, recordCronRun } from '@/src/core/lib/cron'
import { getNotificationsFromEmail, getResendApiKey } from '@/src/core/lib/env'
import { createResendSender } from '@/src/domains/notifications/email/resend'
import { deliverNotifications } from '@/src/domains/notifications/jobs/deliverNotifications'

export const maxDuration = 300 // Vercel Hobby's function ceiling (verified: functions.limitations)

// El schedule vive en `vercel.json` (`0 17 * * *`): una hora DESPUÉS de
// notify-post-show (`0 16`), porque en Hobby un cron corre "en algún momento de
// la hora indicada" y dos crons en la misma hora no tienen orden garantizado.

export async function GET(request: Request) {
    const auth = authorizeCron(request)
    if (!auth.ok) return auth.response

    const apiKey = getResendApiKey()
    const from = getNotificationsFromEmail()
    if (!apiKey || !from) {
        console.error('RESEND_API_KEY o NOTIFICATIONS_FROM_EMAIL no están configurados: se rechaza la corrida.')
        return NextResponse.json({ error: 'Email not configured' }, { status: 503 })
    }

    const supabase = createCronSupabase()
    if (!supabase) return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })

    const startedAt = new Date()
    const result = await deliverNotifications(supabase, createResendSender(apiKey, from), { runStart: startedAt })

    await recordCronRun(supabase, {
        job: 'deliver-notifications',
        startedAt,
        ok: result.ok,
        details: result.details,
    })

    return NextResponse.json({ success: result.ok, ...result.details })
}
```

Modify `vercel.json` — add to the `crons` array:

```json
    {
      "path": "/api/cron/deliver-notifications",
      "schedule": "0 17 * * *"
    }
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/domains/notifications/jobs/deliverNotifications.test.ts app/api/cron/deliver-notifications`
Expected: PASS (7 + 3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/lib/supabase/service.ts src/domains/notifications/jobs/deliverNotifications.ts src/domains/notifications/jobs/deliverNotifications.test.ts app/api/cron/deliver-notifications vercel.json
git commit -m "feat(notifications): add email delivery job and deliver-notifications cron"
```

---

### Task 6: Post-show reminder job and `notify-post-show` cron

**Files:**
- Create: `src/domains/notifications/jobs/notifyPostShow.ts`, `app/api/cron/notify-post-show/route.ts`
- Modify: `vercel.json`
- Test: `src/domains/notifications/jobs/notifyPostShow.test.ts`, `app/api/cron/notify-post-show/route.test.ts`

**Interfaces:**
- Consumes: `notify`, `computePendingForShow` (`@/src/domains/showmode/pending`), `CronSupabaseClient`.
- Produces:
  - `argentinaYesterday(now: Date): { date: string; startIso: string; endIso: string }` — the previous calendar day in `America/Argentina/Buenos_Aires` (fixed UTC−3, no DST): `date` is `YYYY-MM-DD`, `[startIso, endIso)` is that day in UTC.
  - `notifyPostShow(supabase: CronSupabaseClient, options?: { now?: Date; runStart?: Date; budgetMs?: number; clock?: () => number }): Promise<{ ok: boolean; details: { events: number; candidates: number; created: number; duplicates: number; suppressed: number; failed: number; complete: number; stopped_reason?: 'deadline' } }>`

Multi-day festival handling is out of scope for v1: the reminder is keyed to `events.date` (the table has no `end_date`).

- [ ] **Step 1: Write the failing tests**

Create `src/domains/notifications/jobs/notifyPostShow.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CronSupabaseClient } from '@/src/core/lib/cron'

const notify = vi.fn()
vi.mock('../notify', () => ({ notify: (...args: unknown[]) => notify(...args) }))

import { argentinaYesterday, notifyPostShow } from './notifyPostShow'

function query(result: { data: unknown; error: unknown }) {
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'gte', 'lt', 'in']) chain[m] = () => chain
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
    return chain
}

function makeSupabase(tables: Record<string, { data: unknown; error: unknown }>) {
    return { from: (t: string) => query(tables[t]) } as unknown as CronSupabaseClient
}

describe('argentinaYesterday', () => {
    it('is the previous Argentine calendar day, expressed in UTC', () => {
        // 2026-09-19 16:00 UTC is 2026-09-19 13:00 in Buenos Aires -> yesterday is the 18th.
        expect(argentinaYesterday(new Date('2026-09-19T16:00:00Z'))).toEqual({
            date: '2026-09-18',
            startIso: '2026-09-18T03:00:00.000Z',
            endIso: '2026-09-19T03:00:00.000Z',
        })
    })

    it('uses the Argentine date, not the UTC one, near midnight', () => {
        // 2026-09-19 02:00 UTC is still 2026-09-18 23:00 in Buenos Aires -> yesterday is the 17th.
        expect(argentinaYesterday(new Date('2026-09-19T02:00:00Z')).date).toBe('2026-09-17')
    })
})

describe('notifyPostShow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, 'error').mockImplementation(() => {})
        notify.mockResolvedValue({ outcome: 'created', id: 'n1' })
    })

    const now = new Date('2026-09-19T16:00:00Z')

    it('sends one reminder listing everything pending for a show the user attended', async () => {
        const supabase = makeSupabase({
            events: { data: [{ id: 'e1', name: 'Divididos' }], error: null },
            attendance: { data: [{ user_id: 'u1', event_id: 'e1', status: 'went', rating: null, review: null }], error: null },
            expenses: { data: [], error: null },
        })

        const result = await notifyPostShow(supabase, { now })

        expect(notify).toHaveBeenCalledTimes(1)
        expect(notify).toHaveBeenCalledWith(
            supabase,
            expect.objectContaining({
                userId: 'u1',
                type: 'post_show_reminder',
                title: 'Te faltan datos de Divididos',
                body: 'Cargar los gastos de esa noche\nPuntuar el show\nEscribir la reseña',
                dedupeKey: 'post_show:e1',
                payload: { eventId: 'e1', pending: ['expenses', 'rating', 'review'] },
            })
        )
        expect(result).toEqual({
            ok: true,
            details: { events: 1, candidates: 1, created: 1, duplicates: 0, suppressed: 0, failed: 0, complete: 0 },
        })
    })

    it('asks only to confirm attendance when the user was marked as going', async () => {
        const supabase = makeSupabase({
            events: { data: [{ id: 'e1', name: 'Show' }], error: null },
            attendance: { data: [{ user_id: 'u1', event_id: 'e1', status: 'going', rating: null, review: null }], error: null },
            expenses: { data: [], error: null },
        })

        await notifyPostShow(supabase, { now })

        expect(notify).toHaveBeenCalledWith(supabase, expect.objectContaining({ body: 'Confirmar si fuiste' }))
    })

    it('does not notify when nothing is pending', async () => {
        const supabase = makeSupabase({
            events: { data: [{ id: 'e1', name: 'Show' }], error: null },
            attendance: { data: [{ user_id: 'u1', event_id: 'e1', status: 'went', rating: 5, review: 'Genial' }], error: null },
            expenses: { data: [{ user_id: 'u1', event_id: 'e1' }], error: null },
        })

        const result = await notifyPostShow(supabase, { now })

        expect(notify).not.toHaveBeenCalled()
        expect(result.details.complete).toBe(1)
    })

    it('counts duplicates, suppressed and failed outcomes separately', async () => {
        notify
            .mockResolvedValueOnce({ outcome: 'duplicate' })
            .mockResolvedValueOnce({ outcome: 'suppressed' })
            .mockResolvedValueOnce({ outcome: 'failed' })
        const supabase = makeSupabase({
            events: { data: [{ id: 'e1', name: 'Show' }], error: null },
            attendance: {
                data: ['u1', 'u2', 'u3'].map((u) => ({ user_id: u, event_id: 'e1', status: 'went', rating: null, review: null })),
                error: null,
            },
            expenses: { data: [], error: null },
        })

        const result = await notifyPostShow(supabase, { now })

        expect(result.details).toMatchObject({ duplicates: 1, suppressed: 1, failed: 1, created: 0 })
    })

    it('does nothing when no show happened yesterday', async () => {
        const supabase = makeSupabase({ events: { data: [], error: null } })

        const result = await notifyPostShow(supabase, { now })

        expect(result).toEqual({
            ok: true,
            details: { events: 0, candidates: 0, created: 0, duplicates: 0, suppressed: 0, failed: 0, complete: 0 },
        })
    })

    it('reports not-ok when the events read fails', async () => {
        const supabase = makeSupabase({ events: { data: null, error: { message: 'db down' } } })

        expect((await notifyPostShow(supabase, { now })).ok).toBe(false)
    })

    it('stops once the run budget is spent', async () => {
        const supabase = makeSupabase({
            events: { data: [{ id: 'e1', name: 'Show' }], error: null },
            attendance: {
                data: ['u1', 'u2'].map((u) => ({ user_id: u, event_id: 'e1', status: 'went', rating: null, review: null })),
                error: null,
            },
            expenses: { data: [], error: null },
        })
        const clock = vi.fn().mockReturnValueOnce(0).mockReturnValue(1_000)

        const result = await notifyPostShow(supabase, { now, runStart: new Date(0), budgetMs: 500, clock })

        expect(notify).toHaveBeenCalledTimes(1)
        expect(result.details.stopped_reason).toBe('deadline')
    })
})
```

Create `app/api/cron/notify-post-show/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const insert = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({ from: (t: string) => (t === 'cron_runs' ? { insert } : {}) }),
}))

const notifyPostShow = vi.fn()
vi.mock('@/src/domains/notifications/jobs/notifyPostShow', () => ({
    notifyPostShow: (...args: unknown[]) => notifyPostShow(...args),
}))

import { GET } from './route'

const details = { events: 1, candidates: 2, created: 2, duplicates: 0, suppressed: 0, failed: 0, complete: 0 }

function req(secret = 'test-secret') {
    return new Request('http://localhost/api/cron/notify-post-show', { headers: { authorization: `Bearer ${secret}` } })
}

describe('GET /api/cron/notify-post-show', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        insert.mockResolvedValue({ error: null })
        notifyPostShow.mockResolvedValue({ ok: true, details })
        vi.stubEnv('CRON_SECRET', 'test-secret')
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
        vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')
    })

    it('rejects a wrong bearer secret', async () => {
        expect((await GET(req('wrong'))).status).toBe(401)
    })

    it('fails closed when CRON_SECRET is missing', async () => {
        vi.stubEnv('CRON_SECRET', '')
        expect((await GET(req())).status).toBe(503)
    })

    it('runs the job and records the run', async () => {
        const res = await GET(req())

        expect(await res.json()).toEqual({ success: true, ...details })
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ job: 'notify-post-show', ok: true }))
    })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/domains/notifications/jobs/notifyPostShow.test.ts app/api/cron/notify-post-show`
Expected: FAIL — cannot resolve `./notifyPostShow` / `./route`.

- [ ] **Step 3: Write the implementation**

Create `src/domains/notifications/jobs/notifyPostShow.ts`:

```ts
/**
 * Daily post-show reminder (issue #9's "single notice with everything
 * pending"). Looks at the shows of the previous Argentine calendar day, and for
 * every user who marked `going`/`went`, reuses the pure `computePendingForShow`
 * rule. One notification per (user, show), deduped by `post_show:{event_id}`.
 */
import 'server-only'
import { RUN_BUDGET_MS, type CronSupabaseClient } from '@/src/core/lib/cron'
import { computePendingForShow } from '@/src/domains/showmode/pending'
import { notify } from '../notify'

// Buenos Aires is UTC-3 all year (no DST since 2009), so a fixed offset is exact.
const AR_OFFSET_MS = 3 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export function argentinaYesterday(now: Date): { date: string; startIso: string; endIso: string } {
    const argentinaNow = new Date(now.getTime() - AR_OFFSET_MS)
    const startOfTodayAr = Date.UTC(argentinaNow.getUTCFullYear(), argentinaNow.getUTCMonth(), argentinaNow.getUTCDate())
    const start = startOfTodayAr - DAY_MS
    return {
        date: new Date(start).toISOString().slice(0, 10),
        startIso: new Date(start + AR_OFFSET_MS).toISOString(),
        endIso: new Date(startOfTodayAr + AR_OFFSET_MS).toISOString(),
    }
}

export interface NotifyPostShowDetails {
    events: number
    candidates: number
    created: number
    duplicates: number
    suppressed: number
    failed: number
    complete: number
    stopped_reason?: 'deadline'
}

export interface NotifyPostShowOptions {
    now?: Date
    runStart?: Date
    budgetMs?: number
    clock?: () => number
}

interface EventRow {
    id: string
    name: string | null
}
interface AttendanceRow {
    user_id: string
    event_id: string
    status: 'interested' | 'going' | 'went'
    rating: number | null
    review: string | null
}

export async function notifyPostShow(
    supabase: CronSupabaseClient,
    options: NotifyPostShowOptions = {}
): Promise<{ ok: boolean; details: NotifyPostShowDetails }> {
    const details: NotifyPostShowDetails = {
        events: 0, candidates: 0, created: 0, duplicates: 0, suppressed: 0, failed: 0, complete: 0,
    }
    const clock = options.clock ?? Date.now
    const runStart = options.runStart ?? new Date(clock())
    const budgetMs = options.budgetMs ?? RUN_BUDGET_MS
    const window = argentinaYesterday(options.now ?? new Date())

    const { data: eventRows, error: eventsError } = await supabase
        .from('events')
        .select('id, name')
        .gte('date', window.startIso)
        .lt('date', window.endIso)
    if (eventsError) {
        console.error('notifyPostShow: could not read events:', eventsError)
        return { ok: false, details }
    }

    const events = (eventRows ?? []) as EventRow[]
    details.events = events.length
    if (events.length === 0) return { ok: true, details }

    const eventIds = events.map((event) => event.id)
    const [attendanceResult, expensesResult] = await Promise.all([
        supabase
            .from('attendance')
            .select('user_id, event_id, status, rating, review')
            .in('event_id', eventIds)
            .in('status', ['going', 'went']),
        supabase.from('expenses').select('user_id, event_id').in('event_id', eventIds),
    ])
    if (attendanceResult.error || expensesResult.error) {
        console.error('notifyPostShow: could not read attendance/expenses:', attendanceResult.error ?? expensesResult.error)
        return { ok: false, details }
    }

    const expenseCounts = new Map<string, number>()
    for (const expense of (expensesResult.data ?? []) as Array<{ user_id: string; event_id: string }>) {
        const key = `${expense.user_id}:${expense.event_id}`
        expenseCounts.set(key, (expenseCounts.get(key) ?? 0) + 1)
    }
    const eventNames = new Map(events.map((event) => [event.id, event.name ?? 'tu show']))

    const attendances = (attendanceResult.data ?? []) as AttendanceRow[]
    details.candidates = attendances.length

    for (const attendance of attendances) {
        if (clock() - runStart.getTime() >= budgetMs) {
            details.stopped_reason = 'deadline'
            break
        }

        const pending = computePendingForShow({
            attendanceStatus: attendance.status,
            expenseCount: expenseCounts.get(`${attendance.user_id}:${attendance.event_id}`) ?? 0,
            rating: attendance.rating,
            review: attendance.review,
        })
        if (pending.length === 0) {
            details.complete++
            continue
        }

        const { outcome } = await notify(supabase, {
            userId: attendance.user_id,
            type: 'post_show_reminder',
            title: `Te faltan datos de ${eventNames.get(attendance.event_id)}`,
            body: pending.map((item) => item.label).join('\n'),
            payload: { eventId: attendance.event_id, pending: pending.map((item) => item.kind) },
            dedupeKey: `post_show:${attendance.event_id}`,
        })
        if (outcome === 'created') details.created++
        else if (outcome === 'duplicate') details.duplicates++
        else if (outcome === 'suppressed') details.suppressed++
        else details.failed++
    }

    return { ok: true, details }
}
```

Create `app/api/cron/notify-post-show/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { authorizeCron, createCronSupabase, recordCronRun } from '@/src/core/lib/cron'
import { notifyPostShow } from '@/src/domains/notifications/jobs/notifyPostShow'

export const maxDuration = 300 // Vercel Hobby's function ceiling (verified: functions.limitations)

// El schedule vive en `vercel.json` (`0 16 * * *` UTC = 13:00 en Argentina): a esa
// hora el usuario ya durmió y el show fue "ayer". deliver-notifications corre
// una hora después para drenar lo que este job encola.

export async function GET(request: Request) {
    const auth = authorizeCron(request)
    if (!auth.ok) return auth.response

    const supabase = createCronSupabase()
    if (!supabase) return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })

    const startedAt = new Date()
    const result = await notifyPostShow(supabase, { runStart: startedAt })

    await recordCronRun(supabase, {
        job: 'notify-post-show',
        startedAt,
        ok: result.ok,
        details: result.details,
    })

    return NextResponse.json({ success: result.ok, ...result.details })
}
```

Modify `vercel.json` — add to the `crons` array:

```json
    {
      "path": "/api/cron/notify-post-show",
      "schedule": "0 16 * * *"
    }
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/domains/notifications/jobs app/api/cron`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/jobs/notifyPostShow.ts src/domains/notifications/jobs/notifyPostShow.test.ts app/api/cron/notify-post-show vercel.json
git commit -m "feat(notifications): add post-show reminder job and cron"
```

---

### Task 7: Data/service layer, admin message and GraphQL

**Files:**
- Create: `src/domains/notifications/data.ts`, `src/domains/notifications/service.ts`, `src/domains/notifications/adminMessage.ts`, `src/graphql/notifications.ts`
- Modify: `src/graphql/schema.ts` (add `import './notifications'` after `import './taste'`)
- Test: `src/domains/notifications/service.test.ts`, `src/domains/notifications/adminMessage.test.ts`, `src/graphql/notifications.test.ts`

**Interfaces:**
- Consumes: `notify`, `deliverNotifications`, `createResendSender`, `createServiceClient`, `getCurrentUserId`, `createClient` (cookie), `ActionResult` (`@/src/core/types`, `{ error?: string } & TData`).
- Produces:
  - `interface NotificationItem { id: string; type: NotificationType; title: string; body: string; readAt: string | null; createdAt: string }`
  - `interface NotificationPreferenceView { type: NotificationType; label: string; description: string; inApp: boolean; email: boolean }`
  - `listMyNotifications(limit?: number): Promise<NotificationItem[]>`
  - `countMyUnreadNotifications(): Promise<number>` (0 when signed out or on error; never throws)
  - `markMyNotificationsRead(ids?: string[]): Promise<ActionResult>` (`ids` omitted = all)
  - `getMyNotificationPreferences(): Promise<NotificationPreferenceView[]>`
  - `updateMyNotificationPreference(type: NotificationType, channels: ChannelPreference): Promise<ActionResult>`
  - `sendAdminMessage(input: { userId: string; title: string; body: string }): Promise<ActionResult>`
  - GraphQL: `myNotifications(limit: Int)`, `unreadNotificationCount`, `notificationPreferences`, `markNotificationsRead(ids: [ID!])`, `updateNotificationPreference(type: NotificationType!, inApp: Boolean!, email: Boolean!)`, `sendAdminMessage(userId: ID!, title: String!, body: String!)` (admin only).

- [ ] **Step 1: Write the failing tests**

Create `src/domains/notifications/service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCurrentUserId = vi.fn()
vi.mock('@/src/core/auth/session', () => ({ getCurrentUserId: () => getCurrentUserId() }))
vi.mock('@/src/core/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({}) }))

const data = {
    listNotifications: vi.fn(),
    countUnread: vi.fn(),
    markRead: vi.fn(),
    listPreferenceRows: vi.fn(),
    upsertPreference: vi.fn(),
}
vi.mock('./data', () => ({
    listNotifications: (...a: unknown[]) => data.listNotifications(...a),
    countUnread: (...a: unknown[]) => data.countUnread(...a),
    markRead: (...a: unknown[]) => data.markRead(...a),
    listPreferenceRows: (...a: unknown[]) => data.listPreferenceRows(...a),
    upsertPreference: (...a: unknown[]) => data.upsertPreference(...a),
}))

import {
    listMyNotifications,
    countMyUnreadNotifications,
    markMyNotificationsRead,
    getMyNotificationPreferences,
    updateMyNotificationPreference,
} from './service'

describe('notifications service', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, 'error').mockImplementation(() => {})
        getCurrentUserId.mockResolvedValue('u1')
    })

    it('returns nothing for a signed-out visitor', async () => {
        getCurrentUserId.mockResolvedValue(null)

        expect(await listMyNotifications()).toEqual([])
        expect(await countMyUnreadNotifications()).toBe(0)
        expect(await getMyNotificationPreferences()).toEqual([])
        expect(await markMyNotificationsRead()).toEqual({ error: 'No estás autenticado.' })
        expect(await updateMyNotificationPreference('admin_message', { inApp: true, email: true })).toEqual({
            error: 'No estás autenticado.',
        })
    })

    it('lists the signed-in user notifications', async () => {
        data.listNotifications.mockResolvedValue([{ id: 'n1' }])

        expect(await listMyNotifications(10)).toEqual([{ id: 'n1' }])
        expect(data.listNotifications).toHaveBeenCalledWith('u1', 10)
    })

    it('counts unread and degrades to 0 when the read fails', async () => {
        data.countUnread.mockResolvedValueOnce(4).mockRejectedValueOnce(new Error('db'))

        expect(await countMyUnreadNotifications()).toBe(4)
        expect(await countMyUnreadNotifications()).toBe(0)
        expect(console.error).toHaveBeenCalled()
    })

    it('marks as read, reporting a database failure as an error result', async () => {
        data.markRead.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('db'))

        expect(await markMyNotificationsRead(['n1'])).toEqual({})
        expect(data.markRead).toHaveBeenCalledWith('u1', ['n1'])
        expect(await markMyNotificationsRead()).toEqual({ error: 'No pudimos marcar tus avisos como leídos.' })
    })

    it('merges stored preferences over the defaults for every type', async () => {
        data.listPreferenceRows.mockResolvedValue([{ type: 'admin_message', in_app: true, email: false }])

        const views = await getMyNotificationPreferences()

        expect(views.map((v) => v.type)).toEqual(['moderation_rejected', 'post_show_reminder', 'admin_message'])
        expect(views.find((v) => v.type === 'admin_message')).toMatchObject({ inApp: true, email: false })
        expect(views.find((v) => v.type === 'post_show_reminder')).toMatchObject({ inApp: true, email: true })
    })

    it('saves a preference for the signed-in user', async () => {
        data.upsertPreference.mockResolvedValue(undefined)

        expect(await updateMyNotificationPreference('post_show_reminder', { inApp: false, email: true })).toEqual({})
        expect(data.upsertPreference).toHaveBeenCalledWith('u1', 'post_show_reminder', { inApp: false, email: true })
    })

    it('reports a failed preference save as an error result', async () => {
        data.upsertPreference.mockRejectedValue(new Error('db'))

        expect(await updateMyNotificationPreference('admin_message', { inApp: true, email: true })).toEqual({
            error: 'No pudimos guardar tus preferencias.',
        })
    })
})
```

Create `src/domains/notifications/adminMessage.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const after = vi.fn()
vi.mock('next/server', () => ({ after: (fn: () => unknown) => after(fn) }))

const createServiceClient = vi.fn()
vi.mock('@/src/core/lib/supabase/service', () => ({ createServiceClient: () => createServiceClient() }))

const notify = vi.fn()
vi.mock('./notify', () => ({ notify: (...a: unknown[]) => notify(...a) }))

const deliverNotifications = vi.fn()
vi.mock('./jobs/deliverNotifications', () => ({ deliverNotifications: (...a: unknown[]) => deliverNotifications(...a) }))

import { sendAdminMessage } from './adminMessage'

describe('sendAdminMessage', () => {
    const client = { service: true }

    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.stubEnv('RESEND_API_KEY', 're_key')
        vi.stubEnv('NOTIFICATIONS_FROM_EMAIL', 'Ritual <a@r.app>')
        createServiceClient.mockReturnValue(client)
        notify.mockResolvedValue({ outcome: 'created', id: 'n1' })
    })

    it('creates the notification and schedules an immediate email attempt', async () => {
        const result = await sendAdminMessage({ userId: 'u2', title: 'Aviso', body: 'Texto' })

        expect(result).toEqual({})
        expect(notify).toHaveBeenCalledWith(client, { userId: 'u2', type: 'admin_message', title: 'Aviso', body: 'Texto' })
        expect(after).toHaveBeenCalledTimes(1)

        await after.mock.calls[0][0]()
        expect(deliverNotifications).toHaveBeenCalledWith(client, expect.anything(), { onlyIds: ['n1'] })
    })

    it('still succeeds without scheduling delivery when email is not configured (the cron will retry)', async () => {
        vi.stubEnv('RESEND_API_KEY', '')

        expect(await sendAdminMessage({ userId: 'u2', title: 'Aviso', body: 'Texto' })).toEqual({})
        expect(after).not.toHaveBeenCalled()
    })

    it('rejects blank titles and bodies', async () => {
        expect(await sendAdminMessage({ userId: 'u2', title: '  ', body: 'x' })).toEqual({ error: 'El título es obligatorio.' })
        expect(await sendAdminMessage({ userId: 'u2', title: 'x', body: '' })).toEqual({ error: 'El mensaje es obligatorio.' })
        expect(notify).not.toHaveBeenCalled()
    })

    it('reports when the service client is unavailable or notify fails', async () => {
        createServiceClient.mockReturnValueOnce(null)
        expect(await sendAdminMessage({ userId: 'u2', title: 'x', body: 'y' })).toEqual({
            error: 'El servicio de avisos no está configurado.',
        })

        notify.mockResolvedValueOnce({ outcome: 'failed' })
        expect(await sendAdminMessage({ userId: 'u2', title: 'x', body: 'y' })).toEqual({
            error: 'No pudimos enviar el mensaje.',
        })
    })

    it('reports when the recipient turned every channel off', async () => {
        notify.mockResolvedValueOnce({ outcome: 'suppressed' })

        expect(await sendAdminMessage({ userId: 'u2', title: 'x', body: 'y' })).toEqual({
            error: 'La persona desactivó este tipo de aviso.',
        })
    })
})
```

Create `src/graphql/notifications.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const role = vi.fn()
vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ rpc: () => role() }),
}))
vi.mock('@/src/core/auth/session', () => ({ getCurrentUserId: vi.fn().mockResolvedValue('u1') }))

const service = {
  listMyNotifications: vi.fn(),
  countMyUnreadNotifications: vi.fn(),
  markMyNotificationsRead: vi.fn(),
  getMyNotificationPreferences: vi.fn(),
  updateMyNotificationPreference: vi.fn(),
}
vi.mock('@/src/domains/notifications/service', () => ({
  listMyNotifications: (...a: unknown[]) => service.listMyNotifications(...a),
  countMyUnreadNotifications: (...a: unknown[]) => service.countMyUnreadNotifications(...a),
  markMyNotificationsRead: (...a: unknown[]) => service.markMyNotificationsRead(...a),
  getMyNotificationPreferences: (...a: unknown[]) => service.getMyNotificationPreferences(...a),
  updateMyNotificationPreference: (...a: unknown[]) => service.updateMyNotificationPreference(...a),
}))

const sendAdminMessage = vi.fn()
vi.mock('@/src/domains/notifications/adminMessage', () => ({ sendAdminMessage: (...a: unknown[]) => sendAdminMessage(...a) }))

import { POST } from '@/app/api/graphql/route'

async function query(source: string) {
  const response = await POST(
    new Request('http://localhost/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: source }),
    })
  )
  return response.json()
}

describe('notifications GraphQL schema', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    role.mockResolvedValue({ data: 'usuario', error: null })
  })

  it('resolves myNotifications and the unread count', async () => {
    service.listMyNotifications.mockResolvedValue([
      { id: 'n1', type: 'admin_message', title: 'Hola', body: 'Cuerpo', readAt: null, createdAt: '2026-09-19T10:00:00Z' },
    ])
    service.countMyUnreadNotifications.mockResolvedValue(1)

    const body = await query('{ myNotifications(limit: 5) { id type title body readAt createdAt } unreadNotificationCount }')

    expect(body.errors).toBeUndefined()
    expect(service.listMyNotifications).toHaveBeenCalledWith(5)
    expect(body.data.unreadNotificationCount).toBe(1)
    expect(body.data.myNotifications[0]).toMatchObject({ id: 'n1', type: 'admin_message', readAt: null })
  })

  it('resolves the merged preference list', async () => {
    service.getMyNotificationPreferences.mockResolvedValue([
      { type: 'admin_message', label: 'Mensajes del equipo', description: 'd', inApp: true, email: false },
    ])

    const body = await query('{ notificationPreferences { type label inApp email } }')

    expect(body.data.notificationPreferences).toEqual([
      { type: 'admin_message', label: 'Mensajes del equipo', inApp: true, email: false },
    ])
  })

  it('marks notifications read and reports the result', async () => {
    service.markMyNotificationsRead.mockResolvedValue({})

    const body = await query('mutation { markNotificationsRead(ids: ["n1"]) { success error } }')

    expect(service.markMyNotificationsRead).toHaveBeenCalledWith(['n1'])
    expect(body.data.markNotificationsRead).toEqual({ success: true, error: null })
  })

  it('updates a preference', async () => {
    service.updateMyNotificationPreference.mockResolvedValue({})

    const body = await query(
      'mutation { updateNotificationPreference(type: post_show_reminder, inApp: true, email: false) { success } }'
    )

    expect(service.updateMyNotificationPreference).toHaveBeenCalledWith('post_show_reminder', { inApp: true, email: false })
    expect(body.data.updateNotificationPreference.success).toBe(true)
  })

  it('lets an admin send a message', async () => {
    role.mockResolvedValue({ data: 'admin', error: null })
    sendAdminMessage.mockResolvedValue({})

    const body = await query('mutation { sendAdminMessage(userId: "u2", title: "T", body: "B") { success } }')

    expect(sendAdminMessage).toHaveBeenCalledWith({ userId: 'u2', title: 'T', body: 'B' })
    expect(body.data.sendAdminMessage.success).toBe(true)
  })

  it('forbids sendAdminMessage to moderators and regular users', async () => {
    for (const r of ['moderador', 'usuario']) {
      role.mockResolvedValue({ data: r, error: null })

      const body = await query('mutation { sendAdminMessage(userId: "u2", title: "T", body: "B") { success } }')

      expect(body.errors?.[0].extensions.code).toBe('FORBIDDEN')
    }
    expect(sendAdminMessage).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/domains/notifications/service.test.ts src/domains/notifications/adminMessage.test.ts src/graphql/notifications.test.ts`
Expected: FAIL — cannot resolve `./service`, `./adminMessage`, `./notifications`.

- [ ] **Step 3: Write the implementation**

Create `src/domains/notifications/data.ts`:

```ts
import { createClient } from '@/src/core/lib/supabase/server'
import type { ChannelPreference, NotificationType } from './types'

export interface NotificationItem {
    id: string
    type: NotificationType
    title: string
    body: string
    readAt: string | null
    createdAt: string
}

export interface PreferenceRow {
    type: NotificationType
    in_app: boolean
    email: boolean
}

/** All reads and writes here run with the user's JWT, so RLS scopes them to the owner. */
export async function listNotifications(userId: string, limit: number): Promise<NotificationItem[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body, read_at, created_at')
        .eq('user_id', userId)
        .eq('in_app', true)
        .order('created_at', { ascending: false })
        .limit(limit)
    if (error) throw error

    return (data ?? []).map((row) => ({
        id: row.id as string,
        type: row.type as NotificationType,
        title: row.title as string,
        body: row.body as string,
        readAt: (row.read_at as string | null) ?? null,
        createdAt: row.created_at as string,
    }))
}

export async function countUnread(userId: string): Promise<number> {
    const supabase = await createClient()
    const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('in_app', true)
        .is('read_at', null)
    if (error) throw error
    return count ?? 0
}

/** `ids` omitted marks every unread notification of the user as read. */
export async function markRead(userId: string, ids?: string[]): Promise<void> {
    const supabase = await createClient()
    let query = supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('in_app', true)
        .is('read_at', null)
    if (ids) query = query.in('id', ids)
    const { error } = await query
    if (error) throw error
}

export async function listPreferenceRows(userId: string): Promise<PreferenceRow[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('notification_preferences')
        .select('type, in_app, email')
        .eq('user_id', userId)
    if (error) throw error
    return (data ?? []) as PreferenceRow[]
}

export async function upsertPreference(userId: string, type: NotificationType, channels: ChannelPreference): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase.from('notification_preferences').upsert(
        { user_id: userId, type, in_app: channels.inApp, email: channels.email, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,type' }
    )
    if (error) throw error
}
```

Create `src/domains/notifications/service.ts`:

```ts
import { getCurrentUserId } from '@/src/core/auth/session'
import type { ActionResult } from '@/src/core/types'
import {
    listNotifications,
    countUnread,
    markRead,
    listPreferenceRows,
    upsertPreference,
} from './data'
import type { NotificationItem } from './data'
import {
    NOTIFICATION_TYPES,
    NOTIFICATION_TYPE_LABELS,
    resolveChannels,
    type ChannelPreference,
    type NotificationType,
} from './types'

export type { NotificationItem }

export interface NotificationPreferenceView extends ChannelPreference {
    type: NotificationType
    label: string
    description: string
}

const NOT_AUTHENTICATED = 'No estás autenticado.'
const DEFAULT_LIMIT = 50

/**
 * Use-case layer: derives the acting user from the session (never from a
 * caller-supplied id), same pattern as `taste/service.ts`.
 */
export async function listMyNotifications(limit = DEFAULT_LIMIT): Promise<NotificationItem[]> {
    const userId = await getCurrentUserId()
    if (!userId) return []
    return listNotifications(userId, limit)
}

/** Feeds the navbar badge on every page: must never break the layout, so it degrades to 0. */
export async function countMyUnreadNotifications(): Promise<number> {
    const userId = await getCurrentUserId()
    if (!userId) return 0
    try {
        return await countUnread(userId)
    } catch (error) {
        console.error('countMyUnreadNotifications failed:', error)
        return 0
    }
}

export async function markMyNotificationsRead(ids?: string[]): Promise<ActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) return { error: NOT_AUTHENTICATED }
    try {
        await markRead(userId, ids)
        return {}
    } catch (error) {
        console.error('markMyNotificationsRead failed:', error)
        return { error: 'No pudimos marcar tus avisos como leídos.' }
    }
}

export async function getMyNotificationPreferences(): Promise<NotificationPreferenceView[]> {
    const userId = await getCurrentUserId()
    if (!userId) return []
    const rows = await listPreferenceRows(userId)
    return NOTIFICATION_TYPES.map((type) => ({
        type,
        ...NOTIFICATION_TYPE_LABELS[type],
        ...resolveChannels(rows.find((row) => row.type === type)),
    }))
}

export async function updateMyNotificationPreference(
    type: NotificationType,
    channels: ChannelPreference
): Promise<ActionResult> {
    const userId = await getCurrentUserId()
    if (!userId) return { error: NOT_AUTHENTICATED }
    try {
        await upsertPreference(userId, type, channels)
        return {}
    } catch (error) {
        console.error('updateMyNotificationPreference failed:', error)
        return { error: 'No pudimos guardar tus preferencias.' }
    }
}
```

Create `src/domains/notifications/adminMessage.ts`:

```ts
import 'server-only'
import { after } from 'next/server'
import { createServiceClient } from '@/src/core/lib/supabase/service'
import { getNotificationsFromEmail, getResendApiKey } from '@/src/core/lib/env'
import type { ActionResult } from '@/src/core/types'
import { createResendSender } from './email/resend'
import { deliverNotifications } from './jobs/deliverNotifications'
import { notify } from './notify'

/**
 * Admin → user direct message. The caller (GraphQL resolver) has already
 * checked the admin role. The row is created synchronously; the email attempt
 * runs after the response via `after()`. If it fails, the row stays `pending`
 * and the daily deliver-notifications cron retries it.
 */
export async function sendAdminMessage(input: { userId: string; title: string; body: string }): Promise<ActionResult> {
    const title = input.title.trim()
    const body = input.body.trim()
    if (!title) return { error: 'El título es obligatorio.' }
    if (!body) return { error: 'El mensaje es obligatorio.' }

    const supabase = createServiceClient()
    if (!supabase) return { error: 'El servicio de avisos no está configurado.' }

    const { outcome, id } = await notify(supabase, { userId: input.userId, type: 'admin_message', title, body })
    if (outcome === 'suppressed') return { error: 'La persona desactivó este tipo de aviso.' }
    if (outcome !== 'created' || !id) return { error: 'No pudimos enviar el mensaje.' }

    const apiKey = getResendApiKey()
    const from = getNotificationsFromEmail()
    if (apiKey && from) {
        after(async () => {
            await deliverNotifications(supabase, createResendSender(apiKey, from), { onlyIds: [id] })
        })
    }
    return {}
}
```

Create `src/graphql/notifications.ts`:

```ts
import { GraphQLError } from 'graphql'
import { builder } from './builder'
import { MutationResultRef, toMutationResult } from './shared'
import type { GraphQLContext } from './context'
import {
    listMyNotifications,
    countMyUnreadNotifications,
    markMyNotificationsRead,
    getMyNotificationPreferences,
    updateMyNotificationPreference,
    type NotificationItem,
    type NotificationPreferenceView,
} from '@/src/domains/notifications/service'
import { sendAdminMessage } from '@/src/domains/notifications/adminMessage'
import { NOTIFICATION_TYPES } from '@/src/domains/notifications/types'

/** GraphQLError (not Error) so yoga doesn't mask the denial as "Unexpected error." */
function requireAdmin(context: GraphQLContext) {
    if (context.role !== 'admin') {
        throw new GraphQLError('Unauthorized', { extensions: { code: 'FORBIDDEN' } })
    }
}

export const NotificationTypeEnum = builder.enumType('NotificationType', {
    values: NOTIFICATION_TYPES,
})

const NotificationRef = builder.objectRef<NotificationItem>('Notification')
NotificationRef.implement({
    fields: (t) => ({
        id: t.exposeID('id'),
        type: t.field({ type: NotificationTypeEnum, resolve: (n) => n.type }),
        title: t.exposeString('title'),
        body: t.exposeString('body'),
        readAt: t.exposeString('readAt', { nullable: true }),
        createdAt: t.exposeString('createdAt'),
    }),
})

const NotificationPreferenceRef = builder.objectRef<NotificationPreferenceView>('NotificationPreference')
NotificationPreferenceRef.implement({
    fields: (t) => ({
        type: t.field({ type: NotificationTypeEnum, resolve: (p) => p.type }),
        label: t.exposeString('label'),
        description: t.exposeString('description'),
        inApp: t.exposeBoolean('inApp'),
        email: t.exposeBoolean('email'),
    }),
})

builder.queryField('myNotifications', (t) =>
    t.field({
        type: [NotificationRef],
        description: 'Avisos del inbox del usuario actual, más nuevos primero.',
        args: { limit: t.arg.int() },
        resolve: async (_root, args) => listMyNotifications(args.limit ?? undefined),
    })
)

builder.queryField('unreadNotificationCount', (t) =>
    t.int({
        description: 'Cantidad de avisos sin leer del usuario actual (0 sin sesión).',
        resolve: () => countMyUnreadNotifications(),
    })
)

builder.queryField('notificationPreferences', (t) =>
    t.field({
        type: [NotificationPreferenceRef],
        description: 'Preferencia por tipo y canal, con los defaults aplicados.',
        resolve: () => getMyNotificationPreferences(),
    })
)

builder.mutationField('markNotificationsRead', (t) =>
    t.field({
        type: MutationResultRef,
        description: 'Marca como leídos los avisos indicados, o todos si no se pasan ids.',
        args: { ids: t.arg.idList() },
        resolve: async (_root, args) =>
            toMutationResult(await markMyNotificationsRead(args.ids ? args.ids.map(String) : undefined)),
    })
)

builder.mutationField('updateNotificationPreference', (t) =>
    t.field({
        type: MutationResultRef,
        args: {
            type: t.arg({ type: NotificationTypeEnum, required: true }),
            inApp: t.arg.boolean({ required: true }),
            email: t.arg.boolean({ required: true }),
        },
        resolve: async (_root, args) =>
            toMutationResult(await updateMyNotificationPreference(args.type, { inApp: args.inApp, email: args.email })),
    })
)

builder.mutationField('sendAdminMessage', (t) =>
    t.field({
        type: MutationResultRef,
        description: 'Mensaje directo de un administrador a un usuario (inbox + email).',
        args: {
            userId: t.arg.id({ required: true }),
            title: t.arg.string({ required: true }),
            body: t.arg.string({ required: true }),
        },
        resolve: async (_root, args, context) => {
            requireAdmin(context)
            return toMutationResult(
                await sendAdminMessage({ userId: String(args.userId), title: args.title, body: args.body })
            )
        },
    })
)
```

Modify `src/graphql/schema.ts` — add after `import './taste'`:

```ts
import './notifications'
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/domains/notifications src/graphql`
Expected: PASS. If the Pothos enum arg syntax differs (`type: post_show_reminder` in the test query), fix the *test query* to match the enum value the schema exposes, not the schema.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications src/graphql/notifications.ts src/graphql/notifications.test.ts src/graphql/schema.ts
git commit -m "feat(notifications): add notifications service and GraphQL API"
```

---

### Task 8: UI — bell, inbox and settings

**Files:**
- Create: `src/domains/notifications/components/NotificationBell.tsx`, `NotificationList.tsx`, `MarkAllReadButton.tsx`, `NotificationPreferencesForm.tsx`, `index.ts`; `app/notificaciones/page.tsx`, `app/notificaciones/ajustes/page.tsx`
- Modify: `src/core/lib/routes.ts`, `src/core/components/layout/Navbar.tsx`, `app/layout.tsx`
- Test: `src/domains/notifications/components/NotificationBell.test.tsx`, `NotificationList.test.tsx`, `NotificationPreferencesForm.test.tsx`

**Interfaces:**
- Consumes: `NotificationItem`, `NotificationPreferenceView` from `../service`; `unwrapMutation` from `@/src/graphql/mutation-result`; `PageShell` from `@/src/core/components/layout`.
- Produces: `routes.notifications = '/notificaciones'`, `routes.notificationSettings = '/notificaciones/ajustes'`; `<NotificationBell unreadCount={n} />`; `Navbar` accepts optional `unreadNotifications?: number`.

- [ ] **Step 1: Write the failing tests**

Create `src/domains/notifications/components/NotificationBell.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotificationBell } from './NotificationBell'

describe('NotificationBell', () => {
    it('links to the inbox with an accessible label and no badge when nothing is unread', () => {
        render(<NotificationBell unreadCount={0} />)

        const link = screen.getByRole('link', { name: 'Avisos' })
        expect(link).toHaveAttribute('href', '/notificaciones')
        expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument()
    })

    it('shows the unread count in the badge and in the accessible label', () => {
        render(<NotificationBell unreadCount={3} />)

        expect(screen.getByRole('link', { name: 'Avisos, 3 sin leer' })).toBeInTheDocument()
        expect(screen.getByTestId('notification-badge')).toHaveTextContent('3')
    })

    it('caps the badge at 9+', () => {
        render(<NotificationBell unreadCount={42} />)

        expect(screen.getByTestId('notification-badge')).toHaveTextContent('9+')
    })
})
```

Create `src/domains/notifications/components/NotificationList.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotificationList } from './NotificationList'

const items = [
    { id: 'n1', type: 'post_show_reminder' as const, title: 'Te faltan datos', body: 'Puntuar el show\nEscribir la reseña', readAt: null, createdAt: '2026-09-19T10:00:00Z' },
    { id: 'n2', type: 'admin_message' as const, title: 'Hola', body: 'Texto', readAt: '2026-09-19T11:00:00Z', createdAt: '2026-09-18T10:00:00Z' },
]

describe('NotificationList', () => {
    it('shows an empty state', () => {
        render(<NotificationList items={[]} />)

        expect(screen.getByText('No tenés avisos todavía.')).toBeInTheDocument()
    })

    it('renders title and body of each notification', () => {
        render(<NotificationList items={items} />)

        expect(screen.getByText('Te faltan datos')).toBeInTheDocument()
        expect(screen.getByText(/Puntuar el show/)).toBeInTheDocument()
        expect(screen.getByText('Hola')).toBeInTheDocument()
    })

    it('marks unread items so they can be told apart from read ones', () => {
        render(<NotificationList items={items} />)

        expect(screen.getByText('Te faltan datos').closest('li')).toHaveAttribute('data-unread', 'true')
        expect(screen.getByText('Hola').closest('li')).toHaveAttribute('data-unread', 'false')
    })
})
```

Create `src/domains/notifications/components/NotificationPreferencesForm.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const executeMutation = vi.fn()
vi.mock('urql', () => ({
    gql: (s: TemplateStringsArray) => s.join(''),
    useMutation: () => [{}, executeMutation],
}))

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

import { NotificationPreferencesForm } from './NotificationPreferencesForm'

const preferences = [
    { type: 'post_show_reminder' as const, label: 'Recordatorio post-show', description: 'Un solo aviso.', inApp: true, email: true },
    { type: 'admin_message' as const, label: 'Mensajes del equipo', description: 'Avisos del equipo.', inApp: true, email: false },
]

describe('NotificationPreferencesForm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        executeMutation.mockResolvedValue({ data: { updateNotificationPreference: { success: true, error: null } } })
    })

    it('renders one switch per type and channel with the stored state', () => {
        render(<NotificationPreferencesForm preferences={preferences} />)

        expect(screen.getByRole('checkbox', { name: 'Recordatorio post-show — en la app' })).toBeChecked()
        expect(screen.getByRole('checkbox', { name: 'Mensajes del equipo — email' })).not.toBeChecked()
    })

    it('saves the changed channel keeping the other one', async () => {
        render(<NotificationPreferencesForm preferences={preferences} />)

        await userEvent.click(screen.getByRole('checkbox', { name: 'Recordatorio post-show — email' }))

        await waitFor(() =>
            expect(executeMutation).toHaveBeenCalledWith({ type: 'post_show_reminder', inApp: true, email: false })
        )
        expect(refresh).toHaveBeenCalled()
    })

    it('reverts the switch and shows the error when saving fails', async () => {
        executeMutation.mockResolvedValue({ data: { updateNotificationPreference: { success: false, error: 'No pudimos guardar tus preferencias.' } } })
        render(<NotificationPreferencesForm preferences={preferences} />)

        await userEvent.click(screen.getByRole('checkbox', { name: 'Recordatorio post-show — email' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos guardar tus preferencias.')
        expect(screen.getByRole('checkbox', { name: 'Recordatorio post-show — email' })).toBeChecked()
    })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/domains/notifications/components`
Expected: FAIL — cannot resolve the components.

- [ ] **Step 3: Write the implementation**

Modify `src/core/lib/routes.ts` — add next to `showMode` (top level of the `routes` object):

```ts
  /** Inbox de avisos y ajustes por tipo/canal — issue #6. */
  notifications: '/notificaciones',
  notificationSettings: '/notificaciones/ajustes',
```

Create `src/domains/notifications/components/NotificationBell.tsx`:

```tsx
import Link from 'next/link'
import { routes } from '@/src/core/lib/routes'

interface NotificationBellProps {
    unreadCount: number
}

export function NotificationBell({ unreadCount }: NotificationBellProps) {
    const label = unreadCount > 0 ? `Avisos, ${unreadCount} sin leer` : 'Avisos'
    return (
        <Link
            href={routes.notifications}
            aria-label={label}
            className="relative font-label text-[10px] tracking-[0.16em] uppercase text-ritual-gray-text hover:text-white transition-colors"
        >
            Avisos
            {unreadCount > 0 && (
                <span
                    data-testid="notification-badge"
                    aria-hidden="true"
                    className="absolute -top-2 -right-3 min-w-4 h-4 px-1 rounded-full bg-ritual-red text-ritual-bone text-[9px] leading-4 text-center"
                >
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </Link>
    )
}
```

Create `src/domains/notifications/components/NotificationList.tsx`:

```tsx
import type { NotificationItem } from '../data'

interface NotificationListProps {
    items: readonly NotificationItem[]
}

export function NotificationList({ items }: NotificationListProps) {
    if (items.length === 0) {
        return <p className="text-ritual-gray-text">No tenés avisos todavía.</p>
    }

    return (
        <ul className="divide-y divide-white/10">
            {items.map((item) => (
                <li key={item.id} data-unread={item.readAt === null ? 'true' : 'false'} className="py-4 space-y-1">
                    <h3 className={item.readAt === null ? 'font-semibold text-ritual-bone' : 'text-ritual-gray-text'}>
                        {item.title}
                    </h3>
                    <p className="whitespace-pre-line text-sm text-ritual-gray-text">{item.body}</p>
                    <time dateTime={item.createdAt} className="block text-xs text-ritual-gray-text">
                        {new Date(item.createdAt).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}
                    </time>
                </li>
            ))}
        </ul>
    )
}
```

Create `src/domains/notifications/components/MarkAllReadButton.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, gql } from 'urql'
import { unwrapMutation } from '@/src/graphql/mutation-result'
import { Button } from '@/src/core/components/ui/Button'

const MarkAllReadMutation = gql`
  mutation MarkAllNotificationsRead {
    markNotificationsRead { error }
  }
`

export function MarkAllReadButton() {
    const router = useRouter()
    const [, markAllRead] = useMutation(MarkAllReadMutation)
    const [error, setError] = useState<string | null>(null)

    async function handleClick() {
        setError(null)
        const result = unwrapMutation(await markAllRead({}), 'markNotificationsRead', 'No pudimos marcar tus avisos como leídos.')
        if (result.error) {
            setError(result.error)
            return
        }
        router.refresh()
    }

    return (
        <div>
            <Button type="button" onClick={handleClick}>Marcar todo como leído</Button>
            {error && <p role="alert" className="text-sm text-ritual-red-hover">{error}</p>}
        </div>
    )
}
```

Create `src/domains/notifications/components/NotificationPreferencesForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, gql } from 'urql'
import { unwrapMutation } from '@/src/graphql/mutation-result'
import type { NotificationPreferenceView } from '../service'
import type { NotificationType } from '../types'

const UpdatePreferenceMutation = gql`
  mutation UpdateNotificationPreference($type: NotificationType!, $inApp: Boolean!, $email: Boolean!) {
    updateNotificationPreference(type: $type, inApp: $inApp, email: $email) { error }
  }
`

interface NotificationPreferencesFormProps {
    preferences: readonly NotificationPreferenceView[]
}

type Channel = 'inApp' | 'email'

/** One switch per type and channel; each change saves immediately and reverts if the save fails. */
export function NotificationPreferencesForm({ preferences }: NotificationPreferencesFormProps) {
    const router = useRouter()
    const [, updatePreference] = useMutation(UpdatePreferenceMutation)
    const [state, setState] = useState(() =>
        Object.fromEntries(preferences.map((p) => [p.type, { inApp: p.inApp, email: p.email }]))
    )
    const [error, setError] = useState<string | null>(null)

    async function toggle(type: NotificationType, channel: Channel) {
        const previous = state[type]
        const next = { ...previous, [channel]: !previous[channel] }
        setError(null)
        setState((current) => ({ ...current, [type]: next }))

        const result = unwrapMutation(
            await updatePreference({ type, inApp: next.inApp, email: next.email }),
            'updateNotificationPreference',
            'No pudimos guardar tus preferencias.'
        )
        if (result.error) {
            setState((current) => ({ ...current, [type]: previous }))
            setError(result.error)
            return
        }
        router.refresh()
    }

    return (
        <div className="space-y-6">
            {preferences.map((preference) => (
                <fieldset key={preference.type} className="space-y-2">
                    <legend className="font-display text-lg uppercase text-ritual-bone">{preference.label}</legend>
                    <p className="text-sm text-ritual-gray-text">{preference.description}</p>
                    <label className="flex items-center gap-2 text-ritual-bone">
                        <input
                            type="checkbox"
                            aria-label={`${preference.label} — en la app`}
                            checked={state[preference.type].inApp}
                            onChange={() => toggle(preference.type, 'inApp')}
                        />
                        En la app
                    </label>
                    <label className="flex items-center gap-2 text-ritual-bone">
                        <input
                            type="checkbox"
                            aria-label={`${preference.label} — email`}
                            checked={state[preference.type].email}
                            onChange={() => toggle(preference.type, 'email')}
                        />
                        Email
                    </label>
                </fieldset>
            ))}
            {error && <p role="alert" className="text-sm text-ritual-red-hover">{error}</p>}
        </div>
    )
}
```

Create `src/domains/notifications/components/index.ts`:

```ts
export { NotificationBell } from './NotificationBell'
export { NotificationList } from './NotificationList'
export { MarkAllReadButton } from './MarkAllReadButton'
export { NotificationPreferencesForm } from './NotificationPreferencesForm'
```

Create `app/notificaciones/page.tsx`:

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/src/core/lib/supabase/server'
import { PageShell } from '@/src/core/components/layout'
import { routes } from '@/src/core/lib/routes'
import { listMyNotifications } from '@/src/domains/notifications/service'
import { NotificationList, MarkAllReadButton } from '@/src/domains/notifications/components'

export const metadata = {
    title: 'Avisos | RITUAL',
}

export default async function NotificationsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect(routes.login)

    const items = await listMyNotifications()

    return (
        <PageShell title="Avisos" description="Lo que Ritual quiere que sepas.">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex items-center justify-between gap-4">
                    <Link href={routes.notificationSettings} className="text-sm text-ritual-gray-text hover:text-white">
                        Ajustes de avisos
                    </Link>
                    {items.some((item) => item.readAt === null) && <MarkAllReadButton />}
                </div>
                <NotificationList items={items} />
            </div>
        </PageShell>
    )
}
```

Create `app/notificaciones/ajustes/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/src/core/lib/supabase/server'
import { PageShell } from '@/src/core/components/layout'
import { routes } from '@/src/core/lib/routes'
import { getMyNotificationPreferences } from '@/src/domains/notifications/service'
import { NotificationPreferencesForm } from '@/src/domains/notifications/components'

export const metadata = {
    title: 'Ajustes de avisos | RITUAL',
}

export default async function NotificationSettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect(routes.login)

    const preferences = await getMyNotificationPreferences()

    return (
        <PageShell
            backHref={routes.notifications}
            backLabel="← Volver a avisos"
            title="Ajustes de avisos"
            description="Elegí qué avisos querés recibir y por dónde."
        >
            <div className="max-w-2xl mx-auto">
                <NotificationPreferencesForm preferences={preferences} />
            </div>
        </PageShell>
    )
}
```

Modify `src/core/components/layout/Navbar.tsx`:
1. Add import: `import { NotificationBell } from '@/src/domains/notifications/components'`
2. Change props: `interface NavbarProps { user?: User | null; unreadNotifications?: number }` and `export function Navbar({ user, unreadNotifications = 0 }: NavbarProps)`
3. In the "Auth Section", render the bell right before `<ProfileDropdown user={user} />`, inside the `user ? (...)` branch, by turning that branch into a fragment:

```tsx
{user ? (
    <>
        <NotificationBell unreadCount={unreadNotifications} />
        <ProfileDropdown user={user} />
    </>
) : (
```

Modify `app/layout.tsx`:
1. Add import: `import { countMyUnreadNotifications } from "@/src/domains/notifications/service";`
2. Extend the existing `Promise.all` so it resolves the count alongside the profile and banda, and pass it down:

```tsx
  const [profile, bandaAction, unreadNotifications] = await Promise.all([
    user ? findProfile(user.id) : Promise.resolve(null),
    loadBandaAction(user?.id ?? null),
    user ? countMyUnreadNotifications() : Promise.resolve(0),
  ]);
```

and `<Navbar user={user} unreadNotifications={unreadNotifications} />`.

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/domains/notifications/components src/core/components/layout`
Expected: PASS. If an existing `Navbar.test.tsx` breaks because it now imports the bell, wrap nothing: the bell only needs `next/link`, so fix by asserting on the new element, not by mocking the bell.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/components app/notificaciones src/core/lib/routes.ts src/core/components/layout/Navbar.tsx app/layout.tsx
git commit -m "feat(notifications): add navbar bell, inbox and settings screens"
```

---

### Task 9: Docs, follow-up issue and full verification

**Files:**
- Modify: `docs/superpowers/specs/2026-09-19-notifications-design.md`, `src/domains/showmode/pending.ts` (header comment), `docs/backlog-producto.md`

- [ ] **Step 1: Bring the spec in line with what was decided while planning**

In `docs/superpowers/specs/2026-09-19-notifications-design.md`:
- Decisions table: add a row `| Rechazo de moderación | Tipo soportado de punta a punta; el productor se difiere porque moderación no tiene flujo de rechazo (issue aparte). |`
- Section 1, `notifications`: add `in_app boolean` ("false = la fila existe sólo como cola de email") and `email_claimed_at`; note the `claim_pending_notifications` RPC (`for update skip locked`).
- Section 1, preferences: replace "los defaults por tipo definidos en código (el mensaje del admin siempre va por email)" with "ambos canales activos para todos los tipos".
- Section 2, productores: replace the `moderation/service.ts` bullet with "`moderation_rejected`: soportado, sin productor en la v1 (moderación hoy solo aprueba y fusiona)".
- Section 3, Errores: replace "loguea a Sentry" with "loguea con `console.error`, como el resto del repo".
- Section 3, Fuera de la v1: add "flujo de rechazo de moderación, entrada en mobile a la bandeja (el hub de perfil es una grilla fija 2x2), eventos multi-día".
- Crons: `notify-post-show` a las `0 16 * * *` UTC (13:00 AR) y `deliver-notifications` a las `0 17 * * *`, una hora después porque en Hobby dos crons de la misma hora no tienen orden garantizado.

- [ ] **Step 2: Update the dependency note in `pending.ts`**

In `src/domains/showmode/pending.ts`, replace the header block that says the issue #6 system is "NO implementado" with:

```ts
 * El aviso post-show por email/in-app lo arma el cron `notify-post-show`
 * (issue #6, `src/domains/notifications/jobs/notifyPostShow.ts`), que reusa
 * esta función tal cual: la regla de qué falta vive acá, el canal en el
 * dominio de notificaciones.
```

- [ ] **Step 3: Document env vars**

In `docs/backlog-producto.md` (or the env section of the project docs if one exists: `rg -n "CRON_SECRET" docs`), document `RESEND_API_KEY` and `NOTIFICATIONS_FROM_EMAIL` (both required for `deliver-notifications`; without them the cron answers 503 and the in-app inbox keeps working).

- [ ] **Step 4: Full verification**

Run: `npm run lint && npm test && npx supabase test db && npm run build`
Expected: all green. Fix anything red before continuing; do not commit over failures.

- [ ] **Step 5: Commit, then open the follow-up issue**

```bash
git add docs src/domains/showmode/pending.ts
git commit -m "docs(notifications): sync spec with plan and document env vars"
gh issue create --repo Lantieridev/Ritual --label enhancement --title "[Feature] Flujo de rechazo de moderación con motivo" --body "Hoy moderación solo aprueba y fusiona (\`verification_status\` es \`unverified | verified\`). El sistema de notificaciones (#6) ya soporta el tipo \`moderation_rejected\`; falta el flujo que lo dispare: decidir si rechazar borra la fila o marca un estado nuevo, RPC con validación de rol, mutation, UI con campo de motivo, y llamar a \`notify()\` con el creador (\`created_by\`)."
```

(Creating the issue is outward-facing: confirm with the user before running the `gh issue create` command.)

---

## Self-Review

**Spec coverage**
- Data model (tables, dedupe, email state, preferences, RLS, no-client-insert): Task 1.
- `notify()` single entry point, preferences, dedupe, never throws: Task 3.
- `EmailSender` seam + Resend: Task 4.
- Consumer cron with `skip locked`, 3 retries, `RUN_BUDGET_MS`, 503 without config: Task 5 (+ RPC in Task 1).
- Immediate delivery via `after()` for admin messages: Task 7 (`adminMessage.ts`).
- Post-show cron reusing `computePendingForShow`, one notice per show: Task 6.
- Admin message mutation: Task 7.
- Bell, inbox, settings, per-type/per-channel toggles: Task 8.
- Tests: unit per module, pgTAP (RLS, dedupe, claim), route tests, component tests.
- Errors: never-throw `notify`, `failed` state with last error, fail-closed 503: Tasks 3, 5.
- Out of v1 list and the moderation gap: Global Constraints + Task 9.
- Spec item "regenerate types": not applicable — `src/lib/database.types.ts` is not committed in this repo (the `supabase:gen-types` script targets a path that does not exist), so no task touches it.

**Placeholder scan:** none; every code step has full code. The only conditional instruction is the enum-literal note in Task 7 Step 4, which names the exact thing to adjust.

**Type consistency:** `NotificationItem` is defined in `data.ts` (Task 7) and re-exported from `service.ts`; `NotificationList` (Task 8) imports it from `../data`, and the GraphQL layer from `../service`, both the same type. `notify` returns `{ outcome, id? }` in Task 3 and is consumed with that shape in Tasks 6 and 7. `deliverNotifications(supabase, sender, options)` signature is identical in Tasks 5 and 7. `EmailSender.send` throws on failure (Task 4) and `deliverRow` catches (Task 5). `MAX_EMAIL_ATTEMPTS = 3` matches the SQL `email_attempts < 3` in Task 1.
