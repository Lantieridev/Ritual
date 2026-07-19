-- festivals no tenía el índice GIN trigram que artists/venues/events ya
-- traen desde 20260824205500_performance_indexes.sql — sin él, el `ilike`
-- por nombre que agrega searchCatalog() para festivales es un seq scan.
begin;
select plan(1);

select has_index(
  'public',
  'festivals',
  'festivals_name_trgm_idx',
  'festivals tiene el índice GIN trigram sobre name'
);

select * from finish();
rollback;
