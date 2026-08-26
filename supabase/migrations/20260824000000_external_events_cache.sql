CREATE TABLE external_events_cache (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id text NOT NULL,
    dedup_key text NOT NULL,
    event_data jsonb NOT NULL,
    expires_at timestamptz NOT NULL,
    UNIQUE (source_id, dedup_key)
);

-- pg_trgm se habilita acá y no sólo en 20260824205500_performance_indexes.sql:
-- esa migración es posterior, así que en un `supabase db reset` desde cero el
-- índice de abajo fallaba con `operator class "gin_trgm_ops" does not exist` y
-- cortaba toda la cadena de migraciones siguientes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX external_events_cache_title_idx ON external_events_cache USING gin ((event_data->>'title') gin_trgm_ops);

ALTER TABLE external_events_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on external_events_cache"
ON external_events_cache FOR SELECT
USING (true);

-- Service role bypasses RLS for inserts/updates/deletes in the cron job
