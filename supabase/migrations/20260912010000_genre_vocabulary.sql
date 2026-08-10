-- Vocabulario canónico de géneros musicales.
--
-- El signup y el picker de perfil sólo dejan elegir claves de esta tabla
-- (ningún texto libre), y el cron de Last.fm normaliza sus tags contra
-- `genre_aliases` en vez de guardar el string crudo que devuelve la API. Un
-- alias con `genre_key` en null representa un tag de ruido conocido
-- ("live", "seen live", ...) que se descarta a propósito en vez de mapearlo
-- a cualquier género.
create table public.genres (
  key text primary key check (key ~ '^[a-z0-9-]+$'),
  label_es text not null,
  sort integer not null default 0
);

create table public.genre_aliases (
  alias text primary key,
  genre_key text references public.genres (key) on delete cascade
);

-- Relación artista-género, poblada por el catálogo curado y por el cron de
-- Last.fm (`source`). `weight` deja lugar a variantes futuras (ej. un artista
-- con varios tags de Last.fm de distinta fuerza) sin cambiar la forma de la
-- tabla; hoy el catálogo la usa en 1 y el cron todavía no la escribe.
create table public.artist_genres (
  artist_id uuid not null references public.artists (id) on delete cascade,
  genre_key text not null references public.genres (key) on delete cascade,
  source text not null check (source in ('catalog', 'lastfm')),
  weight real not null default 1,
  refreshed_at timestamptz not null default now(),
  primary key (artist_id, genre_key, source)
);

-- Catálogo de sólo lectura para los clientes de PostgREST, mismo patrón que
-- external_events_cache: RLS habilitado con una policy de lectura pública,
-- más `revoke all` (no sólo insert/update/delete, para no dejar TRUNCATE en
-- pie) y `grant select` a nivel de tabla como defensa en profundidad.
alter table public.genres enable row level security;
create policy "Public read genres" on public.genres
  for select to anon, authenticated using (true);
revoke all on public.genres from anon, authenticated;
grant select on public.genres to anon, authenticated;

alter table public.genre_aliases enable row level security;
create policy "Public read genre_aliases" on public.genre_aliases
  for select to anon, authenticated using (true);
revoke all on public.genre_aliases from anon, authenticated;
grant select on public.genre_aliases to anon, authenticated;

alter table public.artist_genres enable row level security;
create policy "Public read artist_genres" on public.artist_genres
  for select to anon, authenticated using (true);
revoke all on public.artist_genres from anon, authenticated;
grant select on public.artist_genres to anon, authenticated;

insert into public.genres (key, label_es, sort) values
  ('rock-nacional', 'Rock Nacional', 10),
  ('indie', 'Indie', 20),
  ('pop', 'Pop', 30),
  ('pop-latino', 'Pop Latino', 40),
  ('trap', 'Trap', 50),
  ('reggaeton', 'Reggaetón', 60),
  ('cumbia', 'Cumbia', 70),
  ('cuarteto', 'Cuarteto', 80),
  ('folklore', 'Folklore', 90),
  ('tango', 'Tango', 100),
  ('electronica', 'Electrónica', 110),
  ('techno', 'Techno', 120),
  ('house', 'House', 130),
  ('drum-and-bass', 'Drum and Bass', 140),
  ('hip-hop', 'Hip Hop', 150),
  ('rap', 'Rap', 160),
  ('jazz', 'Jazz', 170),
  ('blues', 'Blues', 180),
  ('soul', 'Soul', 190),
  ('funk', 'Funk', 200),
  ('punk', 'Punk', 210),
  ('metal', 'Metal', 220),
  ('hardcore', 'Hardcore', 230),
  ('ska', 'Ska', 240),
  ('reggae', 'Reggae', 250),
  ('alternativo', 'Alternativo', 260),
  ('urbano', 'Urbano', 270),
  ('dembow', 'Dembow', 280),
  ('murga', 'Murga', 290),
  ('chamame', 'Chamamé', 300)
on conflict do nothing;

insert into public.genre_aliases (alias, genre_key) values
  ('rock nac', 'rock-nacional'),
  ('rock argentino', 'rock-nacional'),
  ('indie rock', 'indie'),
  ('indie pop', 'indie'),
  ('cumbia villera', 'cumbia'),
  ('electronic', 'electronica'),
  ('tecno', 'techno'),
  ('hip hop', 'hip-hop'),
  ('drum and bass', 'drum-and-bass'),
  ('dnb', 'drum-and-bass'),
  ('alternative', 'alternativo'),
  ('rap argentino', 'rap'),
  ('live', null),
  ('seen live', null),
  ('favorites', null)
on conflict do nothing;
