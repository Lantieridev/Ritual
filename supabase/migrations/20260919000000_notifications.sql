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
