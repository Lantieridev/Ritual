-- Privilegios de tabla para los roles de PostgREST.
--
-- Ninguna migración del repo otorgaba GRANTs explícitos. El proyecto remoto
-- funciona porque Supabase aplica sus default privileges al crear el proyecto
-- (anon/authenticated/service_role reciben todos los privilegios sobre las
-- tablas de `public`, y RLS es la compuerta real). Una base levantada sólo
-- desde estas migraciones no hereda eso: las tablas quedan sin privilegios y
-- toda lectura falla con `42501 permission denied`, aunque las policies estén
-- bien. Verificado en un `supabase start` local: la home no cargaba un solo
-- evento y el cron insertaba cero filas.
--
-- Esta migración reproduce el estado del remoto para que ambos entornos
-- coincidan, con una excepción deliberada en `external_events_cache`.

-- ─── Acceso al schema ───────────────────────────────────────────────────────
grant usage on schema public to anon, authenticated, service_role;

-- ─── Catálogo y datos de usuario ────────────────────────────────────────────
-- Se replica el default de Supabase a propósito: el control de acceso real
-- vive en las policies de RLS, no acá. Cambiar esto a privilegio mínimo por
-- tabla haría que local y remoto difieran, que es justamente la clase de
-- divergencia que esta migración viene a cerrar. Si en algún momento se
-- quiere ajustar, hay que hacerlo en los dos lados a la vez.
grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;

alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;

-- ─── external_events_cache: privilegio mínimo ───────────────────────────────
-- Excepción al bloque de arriba. Esta tabla la escribe únicamente el cron de
-- fuentes externas, que corre con la service role key; nadie más tiene motivo
-- para tocarla. Los clientes sólo la leen. Se revoca toda escritura y se deja
-- únicamente SELECT.
--
-- Se revoca ALL y se re-otorga SELECT en vez de listar los verbos a quitar:
-- un `revoke insert, update, delete` deja TRUNCATE en pie, y TRUNCATE no pasa
-- por RLS — vacía la tabla sin importar las policies.
revoke all on external_events_cache from anon, authenticated;
grant select on external_events_cache to anon, authenticated;

-- ─── PostGIS ────────────────────────────────────────────────────────────────
-- `spatial_ref_sys` es una tabla de sistema de PostGIS y no forma parte del
-- modelo de la app. Se le quita el acceso que el grant masivo le dio: no la
-- consulta ningún código del proyecto.
revoke all on spatial_ref_sys from anon, authenticated;
