-- taste_profiles: los datos de gusto del usuario, separados de `profiles`
-- (que es de lectura pública) porque son privados — géneros favoritos, año
-- de nacimiento, ciudad y usuario de Last.fm sólo le importan al propio
-- dueño y al motor de recomendación de change 2 (home-ranking-strip).
create table public.taste_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  favorite_genre_keys text[] not null default '{}'
    check (cardinality(favorite_genre_keys) <= 5),
  birth_year smallint check (birth_year between 1900 and 2100),
  city_lat double precision,
  city_lng double precision,
  geocoded_location text,
  lastfm_username text check (char_length(lastfm_username) between 2 and 15),
  lastfm_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.taste_profiles enable row level security;

create policy "Owner manages own taste_profiles" on public.taste_profiles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- El cron de refresh-lastfm-imports procesa a los usuarios conectados menos
-- sincronizados primero; el índice parcial excluye a quienes nunca
-- conectaron Last.fm, que son la mayoría.
create index taste_profiles_lastfm_sync_idx
  on public.taste_profiles (lastfm_synced_at nulls first)
  where lastfm_username is not null;
