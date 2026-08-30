-- Issue #56: soporte para sets B2B ("Back-to-Back", dos o más DJs
-- alternándose en la misma sesión). Antes de esto, un mismo slot de lineup
-- sólo podía acreditar a un artista real, o el usuario cargaba un "artista"
-- ficticio combinado ("Sasha B2B Digweed") que ensuciaba el catálogo y le
-- rompía el historial individual a los dos artistas reales.
--
-- b2b_group es simplemente un identificador compartido: dos o más filas de
-- lineups con el mismo event_id y el mismo b2b_group no nulo son un único
-- B2B (2, 3 o más artistas — no hace falta modelar "de a pares"). No es una
-- FK a ninguna tabla nueva porque no hay ningún otro dato que colgarle al
-- grupo en sí; toda la info vive en las filas de lineups que lo comparten.
alter table public.lineups add column if not exists b2b_group uuid;

-- Parcial: la inmensa mayoría de los shows no tiene B2B, así que casi todas
-- las filas tienen b2b_group null -indexar sólo las que sí lo usan.
create index if not exists lineups_b2b_group_idx
  on public.lineups (event_id, b2b_group)
  where b2b_group is not null;
