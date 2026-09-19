-- Festival artist seen tracking.
--
-- The festival schema already models a multi-day festival as `festival_events`
-- linking `festival_id -> event_id`, where each event is one day and owns its own
-- lineup. The simplest schema that matches the existing model is a user-owned
-- table keyed by `festival_id + user_id + artist_id + event_id`; the day is
-- inferred from the event row already attached to the festival. This avoids a
-- duplicate per-day field while staying aligned with the current data model.
--
-- This slice does not add festival-level expenses; those remain out of scope for
-- the issue and are intentionally not represented here.
create table if not exists public.festival_artist_seen (
  id uuid not null default extensions.uuid_generate_v4(),
  festival_id uuid not null references public.festivals(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null,
  artist_id uuid not null references public.artists(id) on delete restrict,
  created_at timestamp with time zone not null default now(),
  constraint festival_artist_seen_pkey primary key (id),
  constraint festival_artist_seen_user_festival_artist_event_unique unique (user_id, festival_id, artist_id, event_id)
);

alter table public.festival_artist_seen enable row level security;

create policy "Users can select own festival_artist_seen rows"
on public.festival_artist_seen for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own festival_artist_seen rows"
on public.festival_artist_seen for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own festival_artist_seen rows"
on public.festival_artist_seen for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own festival_artist_seen rows"
on public.festival_artist_seen for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists festival_artist_seen_festival_user_idx
  on public.festival_artist_seen (festival_id, user_id);

create index if not exists festival_artist_seen_event_idx
  on public.festival_artist_seen (event_id);
