begin;
select plan(6);

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

select has_table('public', 'festival_artist_seen', 'la tabla festival_artist_seen existe');

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

reset role;

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

select is(
  (select artist_id from public.festival_artist_seen where user_id = '11111111-1111-1111-1111-111111111111'),
  'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
  'otro usuario no puede alterar la fila ajena'
);

select * from finish();
rollback;
