-- fill_artist_genre: un usuario autenticado sólo puede completar un género
-- vacío. No puede sobrescribir uno existente ni tocar otras columnas, y un
-- usuario anónimo no puede ejecutarla.
--
-- Se simula la sesión de PostgREST cambiando de rol y seteando
-- `request.jwt.claims`, igual que en taste_profiles_rls.test.sql.
begin;
select plan(7);

insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111');

insert into public.artists (id, name, genre) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Artist Null', null),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Artist Empty', ''),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Artist Set', 'Indie');

select has_function('public', 'fill_artist_genre', array['uuid', 'text'], 'la función existe');

-- ─── usuario autenticado ────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select public.fill_artist_genre('aaaaaaaa-0000-0000-0000-000000000001', 'Rock');
select public.fill_artist_genre('aaaaaaaa-0000-0000-0000-000000000002', 'Pop');
select public.fill_artist_genre('aaaaaaaa-0000-0000-0000-000000000003', 'Rock');

-- Un UPDATE directo ya no está permitido para un usuario común.
update public.artists set name = 'hacked' where id = 'aaaaaaaa-0000-0000-0000-000000000001';

reset role;

select is(
  (select genre from public.artists where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'Rock',
  'completa un género nulo'
);
select is(
  (select genre from public.artists where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  'Pop',
  'completa un género vacío'
);
select is(
  (select genre from public.artists where id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  'Indie',
  'no sobrescribe un género existente'
);
select is(
  (select name from public.artists where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'Artist Null',
  'un UPDATE directo del usuario no puede cambiar otras columnas'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'artists' and policyname = 'Fill empty artist genre'),
  0,
  'la policy amplia de UPDATE ya no existe'
);

-- ─── usuario anónimo ────────────────────────────────────────────────────────
set local role anon;
select throws_ok(
  $$select public.fill_artist_genre('aaaaaaaa-0000-0000-0000-000000000001', 'Metal')$$,
  '42501',
  null,
  'un usuario anónimo no puede ejecutar la función'
);
reset role;

select * from finish();
rollback;
