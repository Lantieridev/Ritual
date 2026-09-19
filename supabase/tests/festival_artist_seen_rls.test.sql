-- festival_artist_seen: privado por dueño. Cada usuario sólo ve y modifica sus
-- propias marcas de "vi a este artista en este día del festival".
--
-- Se simula la sesión de PostgREST cambiando de rol y seteando
-- `request.jwt.claims`, igual que en taste_profiles_rls.test.sql. Los datos
-- de los que dependen las FKs (festival, eventos, artistas) se crean antes
-- de cambiar de rol.
begin;
select plan(6);

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

insert into public.festivals (id, name, start_date) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Festival de prueba', '2026-11-01');

insert into public.events (id, name, date) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Día 1', '2026-11-01T18:00:00Z');

insert into public.artists (id, name) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Artista uno'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Artista dos'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Artista tres');

select has_table('public', 'festival_artist_seen', 'la tabla festival_artist_seen existe');

-- ─── el dueño gestiona sus propias marcas ───────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

insert into public.festival_artist_seen (festival_id, event_id, user_id, artist_id)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '11111111-1111-1111-1111-111111111111',
  'cccccccc-cccc-cccc-cccc-cccccccccccc'
);

select is(
  (select count(*) from public.festival_artist_seen where user_id = '11111111-1111-1111-1111-111111111111')::int,
  1,
  'el dueño puede leer la fila propia'
);

update public.festival_artist_seen
set artist_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
where user_id = '11111111-1111-1111-1111-111111111111';

select is(
  (select artist_id from public.festival_artist_seen where user_id = '11111111-1111-1111-1111-111111111111'),
  'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
  'el dueño puede actualizar su fila'
);

-- No puede escribir marcas a nombre de otro usuario.
select throws_ok(
  $$insert into public.festival_artist_seen (festival_id, event_id, user_id, artist_id)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            '22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc')$$,
  '42501',
  null,
  'no se puede insertar una marca a nombre de otro usuario'
);

reset role;

-- ─── otro usuario no ve ni modifica la fila ajena ───────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is(
  (select count(*) from public.festival_artist_seen where user_id = '11111111-1111-1111-1111-111111111111')::int,
  0,
  'otro usuario no puede leer la fila ajena'
);

update public.festival_artist_seen
set artist_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
where user_id = '11111111-1111-1111-1111-111111111111';

reset role;

select is(
  (select artist_id from public.festival_artist_seen where user_id = '11111111-1111-1111-1111-111111111111'),
  'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
  'otro usuario no puede alterar la fila ajena'
);

select * from finish();
rollback;
