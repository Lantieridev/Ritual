-- Funciones SECURITY DEFINER expuestas por RPC: un usuario anónimo no puede
-- ejecutarlas, y un usuario autenticado sólo puede leer SUS propios resúmenes
-- de gasto. Las funciones de trigger no son invocables por la API.
--
-- Se simula la sesión de PostgREST cambiando de rol y seteando
-- `request.jwt.claims`, igual que en taste_profiles_rls.test.sql.
begin;
select plan(9);

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

-- ─── permisos de ejecución (no dependen de la sesión) ───────────────────────
select is(has_function_privilege('anon', 'public.get_expenses_summary(uuid)', 'execute'), false, 'anon no ejecuta get_expenses_summary');
select is(has_function_privilege('anon', 'public.get_user_role(uuid)', 'execute'), false, 'anon no ejecuta get_user_role');
select is(has_function_privilege('anon', 'public.get_venue_artist_spend_estimate(uuid,uuid,uuid[],uuid)', 'execute'), false, 'anon no ejecuta get_venue_artist_spend_estimate');
select is(has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'), false, 'authenticated no ejecuta la función de trigger handle_new_user');
select is(has_function_privilege('authenticated', 'public.get_expenses_summary(uuid)', 'execute'), true, 'authenticated sí ejecuta get_expenses_summary');

-- ─── un usuario autenticado sólo lee lo propio ──────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is(
  (select (public.get_expenses_summary('11111111-1111-1111-1111-111111111111')::jsonb ->> 'count')::int),
  0,
  'el dueño obtiene su propio resumen'
);

select throws_ok(
  $$select public.get_expenses_summary('22222222-2222-2222-2222-222222222222')$$,
  'P0001',
  'insufficient_privilege',
  'no se puede leer el resumen de gastos de otro usuario'
);

select throws_ok(
  $$select public.get_venue_artist_spend_estimate('22222222-2222-2222-2222-222222222222', null, array[]::uuid[], gen_random_uuid())$$,
  'P0001',
  'insufficient_privilege',
  'no se puede leer la estimación de gasto de otro usuario'
);

reset role;

-- ─── sin sesión: falla cerrado ──────────────────────────────────────────────
set local role anon;
select throws_ok(
  $$select public.get_expenses_summary('11111111-1111-1111-1111-111111111111')$$,
  '42501',
  null,
  'un usuario anónimo no puede ejecutar get_expenses_summary'
);
reset role;

select * from finish();
rollback;
