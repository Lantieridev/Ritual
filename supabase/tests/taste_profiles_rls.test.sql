-- taste_profiles: privado por dueño. A diferencia de `profiles` (lectura
-- pública), nadie más que el propio usuario puede ver ni tocar sus géneros
-- favoritos, año de nacimiento, ciudad o usuario de Last.fm.
--
-- Se simula la sesión de PostgREST cambiando de rol y seteando
-- `request.jwt.claims`, que es exactamente lo que lee `auth.uid()` — el
-- mismo mecanismo real que usa el API Gateway de Supabase, sin depender de
-- ninguna extensión de testing adicional.
--
-- `handle_new_user()` ya crea la fila de taste_profiles al mismo tiempo que
-- el auth.users, así que este test la actualiza (no la inserta) para probar
-- las policies de dueño.
begin;
select plan(6);

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

select has_table('public', 'taste_profiles', 'la tabla taste_profiles existe');

-- ─── el dueño gestiona su propia fila ───────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

update public.taste_profiles set birth_year = 1995
where user_id = '11111111-1111-1111-1111-111111111111';

select is(
  (select birth_year from public.taste_profiles where user_id = '11111111-1111-1111-1111-111111111111'),
  1995::smallint,
  'el dueño lee su propia fila recién actualizada'
);

update public.taste_profiles set birth_year = 1996
where user_id = '11111111-1111-1111-1111-111111111111';

select is(
  (select birth_year from public.taste_profiles where user_id = '11111111-1111-1111-1111-111111111111'),
  1996::smallint,
  'el dueño actualiza su propia fila de nuevo'
);

reset role;

-- ─── otro usuario no ve ni puede tocar la fila ajena ────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is(
  (select count(*) from public.taste_profiles where user_id = '11111111-1111-1111-1111-111111111111')::int,
  0,
  'otro usuario no puede leer la fila ajena'
);

update public.taste_profiles set birth_year = 2000
where user_id = '11111111-1111-1111-1111-111111111111';

update public.taste_profiles set birth_year = 1990
where user_id = '22222222-2222-2222-2222-222222222222';

select is(
  (select birth_year from public.taste_profiles where user_id = '22222222-2222-2222-2222-222222222222'),
  1990::smallint,
  'el segundo usuario puede gestionar su propia fila'
);

reset role;

select is(
  (select birth_year from public.taste_profiles where user_id = '11111111-1111-1111-1111-111111111111'),
  1996::smallint,
  'el update del otro usuario contra la fila ajena no tuvo efecto'
);

select * from finish();
rollback;
