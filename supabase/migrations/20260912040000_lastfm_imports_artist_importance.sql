-- lastfm_imports: el top de artistas de Last.fm por usuario, acotado a 50
-- filas por los términos de uso de la API (ver el ADR de la propuesta).
-- Privado por dueño, igual que taste_profiles.
create table public.lastfm_imports (
  user_id uuid not null references auth.users (id) on delete cascade,
  artist_name_key text not null,
  artist_name text not null,
  artist_id uuid references public.artists (id) on delete set null,
  rank smallint not null check (rank between 1 and 50),
  playcount integer,
  fetched_at timestamptz not null default now(),
  primary key (user_id, artist_name_key)
);

alter table public.lastfm_imports enable row level security;

create policy "Owner manages own lastfm_imports" on public.lastfm_imports
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- artist_importance: peso combinado de ranking regional de Last.fm y
-- asistencia in-app, público para que change 2 pueda ordenar por él sin
-- exponer quién asistió. went_count nunca queda en 1 ni 2 — menos de 3
-- asistencias identificaría a los asistentes de un artista de nicho, así
-- que el clamp se aplica antes de llegar a la fila.
create table public.artist_importance (
  artist_id uuid primary key references public.artists (id) on delete cascade,
  geo_rank smallint,
  geo_listeners integer,
  went_count integer not null default 0 check (went_count = 0 or went_count >= 3),
  peso real check (peso between 0 and 1),
  refreshed_at timestamptz not null default now()
);

alter table public.artist_importance enable row level security;
create policy "Public read artist_importance" on public.artist_importance
  for select to anon, authenticated using (true);
revoke all on public.artist_importance from anon, authenticated;
grant select on public.artist_importance to anon, authenticated;

-- Agrega, por artista, cuántas asistencias "went" tiene en toda la base —
-- sin ese agregado, calcular el peso en TS requeriría paginar toda la tabla
-- attendance (privada por dueño) fila por fila. security definer para poder
-- leer a través de esa RLS; execute queda reservado al cron (service_role).
create or replace function public.artist_went_counts()
returns table (artist_id uuid, went_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select l.artist_id, count(*) as went_count
  from public.attendance a
  join public.lineups l on l.event_id = a.event_id
  where a.status = 'went'
  group by l.artist_id;
$$;

revoke execute on function public.artist_went_counts() from public, anon, authenticated;
grant execute on function public.artist_went_counts() to service_role;

-- cron_runs gana `details` para que los crons de taste (importance/lastfm)
-- escriban sus propios contadores sin depender de los 3 contadores legacy
-- del cron de fuentes externas, que hasta ahora eran `not null` sin default
-- y obligaban a inventar valores falsos para cualquier otro job.
alter table public.cron_runs
  alter column adapters_total set default 0,
  alter column adapters_failed set default 0,
  alter column events_inserted set default 0,
  add column if not exists details jsonb not null default '{}'::jsonb;
