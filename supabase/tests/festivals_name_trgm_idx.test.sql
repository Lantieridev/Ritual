-- festivals no tenía el índice GIN trigram que artists/venues/events ya
-- traen desde 20260824205500_performance_indexes.sql — sin él, el `ilike`
-- por nombre que agrega searchCatalog() para festivales es un seq scan.
begin;
select plan(2);

select has_index(
  'public',
  'festivals',
  'festivals_name_trgm_idx',
  'festivals tiene el índice GIN trigram sobre name'
);

-- has_index sólo confirma que existe UN índice con ese nombre sobre esa
-- columna — no que sea realmente capaz de acelerar el `ilike` que hace
-- searchCatalog(). Un EXPLAIN acá sería frágil (con la tabla de test vacía,
-- el planner elige seq scan sin importar si el índice existe), así que se
-- verifica lo que sí determina si el `ilike` PUEDE usarlo, con la tabla
-- vacía o llena: que la definición use `gin` con la clase de operador
-- `gin_trgm_ops`, igual que events/artists/venues en
-- 20260824205500_performance_indexes.sql.
select ok(
  pg_get_indexdef('public.festivals_name_trgm_idx'::regclass) ~ 'USING gin .*gin_trgm_ops',
  'festivals_name_trgm_idx usa GIN con gin_trgm_ops, no un btree que ilike no puede usar'
);

select * from finish();
rollback;
