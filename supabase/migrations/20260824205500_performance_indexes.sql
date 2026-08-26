-- 1. B-Tree Indexes para escaneos y ordenamiento frecuente
CREATE INDEX IF NOT EXISTS events_date_idx ON public.events (date DESC);
CREATE INDEX IF NOT EXISTS event_photos_event_id_idx ON public.event_photos (event_id);

-- 2. Habilitar extensión pg_trgm si no existe (requerido para gin_trgm_ops)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 3. GIN Trigram Indexes para optimizar las búsquedas de texto (ILIKE) en el catálogo
CREATE INDEX IF NOT EXISTS events_name_trgm_idx ON public.events USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS artists_name_trgm_idx ON public.artists USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS venues_name_trgm_idx ON public.venues USING gin (name gin_trgm_ops);
