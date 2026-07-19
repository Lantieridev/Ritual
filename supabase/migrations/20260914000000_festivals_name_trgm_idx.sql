-- festivals se quedó afuera de 20260824205500_performance_indexes.sql, que
-- creó los índices GIN trigram de events/artists/venues. searchCatalog()
-- necesita el mismo patrón para poder buscar festivales por nombre sin caer
-- en un seq scan.
CREATE INDEX IF NOT EXISTS festivals_name_trgm_idx ON public.festivals USING gin (name gin_trgm_ops);
