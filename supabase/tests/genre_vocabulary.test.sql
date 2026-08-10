-- Vocabulario canónico de géneros: catálogo público de sólo lectura.
--
-- anon/authenticated deben poder leer genres/genre_aliases/artist_genres
-- (son datos de catálogo, igual que artists/venues) pero no escribirlos: sólo
-- el cron de importancia (service_role) los puebla. `revoke all` en vez de
-- `revoke insert, update, delete` a propósito — la lección de
-- 20260826000000_table_grants.sql es que ese segundo approach deja TRUNCATE
-- en pie, que no pasa por RLS.
begin;
select plan(11);

select has_table('public', 'genres', 'la tabla genres existe');
select has_table('public', 'genre_aliases', 'la tabla genre_aliases existe');
select has_table('public', 'artist_genres', 'la tabla artist_genres existe');

select ok(
  has_table_privilege('anon', 'public.genres', 'SELECT')
    and not has_table_privilege('anon', 'public.genres', 'INSERT')
    and not has_table_privilege('anon', 'public.genres', 'UPDATE')
    and not has_table_privilege('anon', 'public.genres', 'DELETE')
    and not has_table_privilege('anon', 'public.genres', 'TRUNCATE'),
  'anon sólo puede leer genres'
);
select ok(
  has_table_privilege('authenticated', 'public.genres', 'SELECT')
    and not has_table_privilege('authenticated', 'public.genres', 'INSERT')
    and not has_table_privilege('authenticated', 'public.genres', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.genres', 'DELETE')
    and not has_table_privilege('authenticated', 'public.genres', 'TRUNCATE'),
  'authenticated sólo puede leer genres'
);

select ok(
  has_table_privilege('anon', 'public.genre_aliases', 'SELECT')
    and not has_table_privilege('anon', 'public.genre_aliases', 'INSERT')
    and not has_table_privilege('anon', 'public.genre_aliases', 'UPDATE')
    and not has_table_privilege('anon', 'public.genre_aliases', 'DELETE')
    and not has_table_privilege('anon', 'public.genre_aliases', 'TRUNCATE'),
  'anon sólo puede leer genre_aliases'
);
select ok(
  has_table_privilege('authenticated', 'public.genre_aliases', 'SELECT')
    and not has_table_privilege('authenticated', 'public.genre_aliases', 'INSERT')
    and not has_table_privilege('authenticated', 'public.genre_aliases', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.genre_aliases', 'DELETE')
    and not has_table_privilege('authenticated', 'public.genre_aliases', 'TRUNCATE'),
  'authenticated sólo puede leer genre_aliases'
);

select ok(
  has_table_privilege('anon', 'public.artist_genres', 'SELECT')
    and not has_table_privilege('anon', 'public.artist_genres', 'INSERT')
    and not has_table_privilege('anon', 'public.artist_genres', 'UPDATE')
    and not has_table_privilege('anon', 'public.artist_genres', 'DELETE')
    and not has_table_privilege('anon', 'public.artist_genres', 'TRUNCATE'),
  'anon sólo puede leer artist_genres'
);
select ok(
  has_table_privilege('authenticated', 'public.artist_genres', 'SELECT')
    and not has_table_privilege('authenticated', 'public.artist_genres', 'INSERT')
    and not has_table_privilege('authenticated', 'public.artist_genres', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.artist_genres', 'DELETE')
    and not has_table_privilege('authenticated', 'public.artist_genres', 'TRUNCATE'),
  'authenticated sólo puede leer artist_genres'
);

select cmp_ok((select count(*) from public.genres)::int, '>=', 20, 'el seed carga al menos 20 géneros');
select is(
  (select genre_key from public.genre_aliases where alias = 'rock nac'),
  'rock-nacional',
  'el alias "rock nac" normaliza a rock-nacional'
);

select * from finish();
rollback;
