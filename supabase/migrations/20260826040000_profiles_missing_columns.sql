-- Agrega las columnas de `profiles` que nunca llegaron a crearse.
--
-- `20260218250000_create_profiles.sql` declara la tabla con username,
-- full_name, avatar_url, website, bio, location y updated_at — pero lo hace con
-- `create table if not exists`, y `profiles` ya existía desde el dump inicial
-- (`20260216230841_remote_schema.sql:100`) con sólo id, username, avatar_url,
-- bio y created_at. El `if not exists` convirtió el CREATE entero en un no-op y
-- las cuatro columnas restantes nunca existieron.
--
-- Es el mismo patrón que la colisión de `events.status`: un `create ... if not
-- exists` que aplica limpio y deja el esquema a medias, sin que ninguna
-- migración falle.
--
-- Consecuencias que esto arregla:
--   * `modifyProfile` (src/domains/auth/service.ts) escribe full_name, website
--     y location, así que editar el perfil fallaba siempre contra la base.
--   * `/profile` mostraba "Sin nombre" para todo el mundo, porque leía
--     `profile.full_name`, y nunca renderizaba ubicación ni sitio web.
--
-- El tipo `Profile` de src/core/types ya declaraba las cuatro, así que el
-- código estaba escrito contra el esquema que se pretendía, no contra el real.

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists website text,
  add column if not exists location text,
  add column if not exists updated_at timestamptz;
