-- artist_importance: peso público, sólo el cron (service_role) lo escribe.
--
-- went_count nunca puede quedar en 1 ni 2: menos de 3 asistencias "went"
-- identificaría a quién fue a ver a un artista de nicho, así que el check
-- constraint sólo acepta 0 o >= 3 — el clamp ocurre antes de llegar a la
-- fila, nunca después. artist_went_counts() agrega esos conteos crudos para
-- el cron y no debe ser invocable desde PostgREST (anon/authenticated).
begin;
select plan(8);

insert into public.artists (id, name) values
  ('33333333-3333-3333-3333-333333333333', 'Artista de prueba');

select has_table('public', 'artist_importance', 'la tabla artist_importance existe');

select lives_ok(
  $$ insert into public.artist_importance (artist_id, went_count) values ('33333333-3333-3333-3333-333333333333', 0) $$,
  'went_count = 0 es válido'
);

select throws_ok(
  $$ update public.artist_importance set went_count = 1 where artist_id = '33333333-3333-3333-3333-333333333333' $$,
  '23514',
  null,
  'went_count = 1 viola el check constraint'
);

select throws_ok(
  $$ update public.artist_importance set went_count = 2 where artist_id = '33333333-3333-3333-3333-333333333333' $$,
  '23514',
  null,
  'went_count = 2 viola el check constraint'
);

select lives_ok(
  $$ update public.artist_importance set went_count = 3 where artist_id = '33333333-3333-3333-3333-333333333333' $$,
  'went_count = 3 es válido'
);

select has_function('public', 'artist_went_counts', 'artist_went_counts() existe');

select ok(
  not has_function_privilege('anon', 'public.artist_went_counts()', 'EXECUTE'),
  'anon no puede ejecutar artist_went_counts()'
);
select ok(
  not has_function_privilege('authenticated', 'public.artist_went_counts()', 'EXECUTE'),
  'authenticated no puede ejecutar artist_went_counts()'
);

select * from finish();
rollback;
