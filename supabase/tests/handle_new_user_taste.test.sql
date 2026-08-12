-- handle_new_user() nunca puede tirar abajo el signup por metadata de gusto
-- mal formada. La matriz de abajo cubre géneros como string/objeto/clave
-- desconocida/más de 5/duplicados, y año de nacimiento no numérico,
-- inverosímil (muy viejo o muy joven), numérico crudo, y metadata ausente
-- por completo — en todos los casos la fila de `profiles` se crea igual y
-- `taste_profiles` degrada a valores seguros en vez de propagar un error.
begin;
select plan(24);

-- ─── caso válido (regresión: nada de esto rompe el camino feliz) ───────────
insert into auth.users (id, raw_user_meta_data) values (
  '00000000-0000-0000-0000-000000000000',
  '{"genres": ["indie", "rock-nacional"], "birth_year": "1995"}'::jsonb
);
select ok(
  exists(select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000000'),
  'caso válido: el signup crea la fila de profiles'
);
select is(
  (select favorite_genre_keys from public.taste_profiles where user_id = '00000000-0000-0000-0000-000000000000'),
  array['indie', 'rock-nacional'],
  'caso válido: los géneros válidos se guardan en orden'
);

-- ─── géneros como string (no array) ─────────────────────────────────────────
insert into auth.users (id, raw_user_meta_data) values (
  '00000000-0000-0000-0000-000000000001',
  '{"genres": "rock", "birth_year": "1995"}'::jsonb
);
select ok(
  exists(select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000001'),
  'genres como string: el signup igual crea profiles'
);
select is(
  (select favorite_genre_keys from public.taste_profiles where user_id = '00000000-0000-0000-0000-000000000001'),
  array[]::text[],
  'genres como string: se descarta y queda vacío'
);

-- ─── géneros como objeto ─────────────────────────────────────────────────────
insert into auth.users (id, raw_user_meta_data) values (
  '00000000-0000-0000-0000-000000000002',
  '{"genres": {"a": 1}, "birth_year": "1995"}'::jsonb
);
select ok(
  exists(select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000002'),
  'genres como objeto: el signup igual crea profiles'
);
select is(
  (select favorite_genre_keys from public.taste_profiles where user_id = '00000000-0000-0000-0000-000000000002'),
  array[]::text[],
  'genres como objeto: se descarta y queda vacío'
);

-- ─── clave de género desconocida ────────────────────────────────────────────
insert into auth.users (id, raw_user_meta_data) values (
  '00000000-0000-0000-0000-000000000003',
  '{"genres": ["no-existe-este-genero"], "birth_year": "1995"}'::jsonb
);
select ok(
  exists(select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000003'),
  'clave desconocida: el signup igual crea profiles'
);
select is(
  (select favorite_genre_keys from public.taste_profiles where user_id = '00000000-0000-0000-0000-000000000003'),
  array[]::text[],
  'clave desconocida: se descarta y queda vacío'
);

-- ─── más de 5 géneros válidos ────────────────────────────────────────────────
insert into auth.users (id, raw_user_meta_data) values (
  '00000000-0000-0000-0000-000000000004',
  '{"genres": ["indie", "pop", "rock-nacional", "trap", "techno", "house", "jazz"], "birth_year": "1995"}'::jsonb
);
select ok(
  exists(select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000004'),
  'más de 5 géneros: el signup igual crea profiles'
);
select is(
  (select favorite_genre_keys from public.taste_profiles where user_id = '00000000-0000-0000-0000-000000000004'),
  array['indie', 'pop', 'rock-nacional', 'trap', 'techno'],
  'más de 5 géneros: sólo se guardan los primeros 5, en orden'
);

-- ─── géneros duplicados ──────────────────────────────────────────────────────
insert into auth.users (id, raw_user_meta_data) values (
  '00000000-0000-0000-0000-000000000005',
  '{"genres": ["indie", "indie", "pop"], "birth_year": "1995"}'::jsonb
);
select ok(
  exists(select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000005'),
  'géneros duplicados: el signup igual crea profiles'
);
select is(
  (select favorite_genre_keys from public.taste_profiles where user_id = '00000000-0000-0000-0000-000000000005'),
  array['indie', 'pop'],
  'géneros duplicados: se deduplican preservando el orden'
);

-- ─── año de nacimiento no numérico ───────────────────────────────────────────
insert into auth.users (id, raw_user_meta_data) values (
  '00000000-0000-0000-0000-000000000006',
  '{"genres": ["indie"], "birth_year": "abc"}'::jsonb
);
select ok(
  exists(select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000006'),
  'año no numérico: el signup igual crea profiles'
);
select is(
  (select birth_year from public.taste_profiles where user_id = '00000000-0000-0000-0000-000000000006'),
  null::smallint,
  'año no numérico: birth_year queda null'
);

-- ─── año de nacimiento inverosímil (muy viejo) ──────────────────────────────
insert into auth.users (id, raw_user_meta_data) values (
  '00000000-0000-0000-0000-000000000007',
  '{"genres": ["indie"], "birth_year": "1850"}'::jsonb
);
select ok(
  exists(select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000007'),
  'año muy viejo: el signup igual crea profiles'
);
select is(
  (select birth_year from public.taste_profiles where user_id = '00000000-0000-0000-0000-000000000007'),
  null::smallint,
  'año muy viejo: birth_year queda null'
);

-- ─── año de nacimiento inverosímil (muy joven) ──────────────────────────────
insert into auth.users (id, raw_user_meta_data) values (
  '00000000-0000-0000-0000-000000000008',
  '{"genres": ["indie"], "birth_year": "2020"}'::jsonb
);
select ok(
  exists(select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000008'),
  'año muy joven: el signup igual crea profiles'
);
select is(
  (select birth_year from public.taste_profiles where user_id = '00000000-0000-0000-0000-000000000008'),
  null::smallint,
  'año muy joven: birth_year queda null'
);

-- ─── año de nacimiento como número JSON crudo (no string) ───────────────────
insert into auth.users (id, raw_user_meta_data) values (
  '00000000-0000-0000-0000-000000000009',
  '{"genres": ["indie"], "birth_year": 1995}'::jsonb
);
select ok(
  exists(select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000009'),
  'año como número JSON: el signup igual crea profiles'
);
select is(
  (select birth_year from public.taste_profiles where user_id = '00000000-0000-0000-0000-000000000009'),
  1995::smallint,
  'año como número JSON: se guarda igual que un string'
);

-- ─── metadata completamente ausente ─────────────────────────────────────────
insert into auth.users (id, raw_user_meta_data) values (
  '00000000-0000-0000-0000-00000000000a',
  null
);
select ok(
  exists(select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'sin metadata: el signup igual crea profiles'
);
select ok(
  exists(select 1 from public.taste_profiles where user_id = '00000000-0000-0000-0000-00000000000a'),
  'sin metadata: taste_profiles se crea con valores por defecto'
);

-- ─── las cláusulas de seguridad sobreviven al create or replace ────────────
-- CREATE OR REPLACE resetea cualquier cláusula no restated explícitamente,
-- así que esto falla si una futura edición del trigger se olvida de
-- `security definer` o `set search_path`.
select ok(
  (select prosecdef from pg_proc where oid = 'public.handle_new_user()'::regprocedure),
  'handle_new_user sigue siendo security definer'
);
select ok(
  (select 'search_path=public' = any(proconfig) from pg_proc where oid = 'public.handle_new_user()'::regprocedure),
  'handle_new_user sigue fijando search_path=public'
);

select * from finish();
rollback;
