-- 1. Create Enum
CREATE TYPE verification_status AS ENUM ('unverified', 'verified');

-- 1.5 La columna `events.status` ya existía como `text default 'scheduled'`
-- desde el dump inicial (20260216230841_remote_schema.sql), y ninguna
-- migración la eliminó. Sin este drop, el ALTER de más abajo falla con
-- `column "status" of relation "events" already exists` — y como es una sola
-- sentencia, se cae también `events.created_by`, que el trigger de rate limit
-- escribe en cada INSERT. Resultado: `supabase db reset` dejaba la base
-- inutilizable.
--
-- Se puede dropear sin migrar datos: ningún archivo de `src/` ni de `app/`
-- lee los valores 'scheduled'/'confirmed' de esa columna, y el `status` que
-- expone `src/graphql/events.ts` pasa a ser el de verificación.
ALTER TABLE events DROP COLUMN IF EXISTS status;

-- 2. Add status and audit columns
ALTER TABLE artists 
  ADD COLUMN status verification_status DEFAULT 'unverified' NOT NULL,
  ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE venues 
  ADD COLUMN status verification_status DEFAULT 'unverified' NOT NULL,
  ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE events 
  ADD COLUMN status verification_status DEFAULT 'unverified' NOT NULL,
  ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2.5 Rate Limiting & Auditing Trigger (Best Practice)
-- Evita que un bot autenticado inunde la base de datos con spam
CREATE OR REPLACE FUNCTION check_creation_rate_limit()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recent_count INT;
BEGIN
  -- 1. Auto-asignar la autoría para auditoría (saber a quién banear si spamea)
  NEW.created_by = auth.uid();

  -- 2. Los admins y moderadores no tienen rate limit
  IF public.get_user_role(auth.uid()) IN ('admin', 'moderador') THEN
    RETURN NEW;
  END IF;

  -- 3. Contar cuántos registros creó este usuario en la última hora en la tabla actual
  -- Usamos SQL dinámico para poder reusar este mismo trigger en venues, artists y events
  EXECUTE format('SELECT count(*) FROM %I WHERE created_by = $1 AND created_at > now() - interval ''1 hour''', TG_TABLE_NAME)
  INTO recent_count
  USING auth.uid();

  -- 4. Límite estricto: máximo 5 creaciones por hora por usuario
  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'rate_limit_exceeded' USING HINT = 'Has alcanzado el límite máximo de creaciones por hora.';
  END IF;

  RETURN NEW;
END;
$$;

-- Aplicar el escudo a las 3 tablas de catálogo
CREATE TRIGGER tr_artists_rate_limit
  BEFORE INSERT ON artists
  FOR EACH ROW EXECUTE FUNCTION check_creation_rate_limit();

CREATE TRIGGER tr_venues_rate_limit
  BEFORE INSERT ON venues
  FOR EACH ROW EXECUTE FUNCTION check_creation_rate_limit();

CREATE TRIGGER tr_events_rate_limit
  BEFORE INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION check_creation_rate_limit();

-- 3. Merge Artists RPC
CREATE OR REPLACE FUNCTION merge_artists(source_id UUID, target_id UUID) 
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- SEGURIDAD: Solo admins y moderadores pueden ejecutar esta fusión
  IF public.get_user_role(auth.uid()) NOT IN ('admin', 'moderador') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING HINT = 'Only admins and moderators can merge entities';
  END IF;

  -- Reassign lineups, skipping if target already plays in that event
  UPDATE lineups ea1
  SET artist_id = target_id
  WHERE artist_id = source_id
    AND NOT EXISTS (
      SELECT 1 FROM lineups ea2 WHERE ea2.artist_id = target_id AND ea2.event_id = ea1.event_id
    );
  DELETE FROM lineups WHERE artist_id = source_id;

  -- Reassign wishlist, skipping if target is already in user's wishlist
  UPDATE wishlist w1
  SET artist_id = target_id
  WHERE artist_id = source_id
    AND NOT EXISTS (
      SELECT 1 FROM wishlist w2 WHERE w2.artist_id = target_id AND w2.user_id = w1.user_id
    );
  DELETE FROM wishlist WHERE artist_id = source_id;

  -- Delete the source artist
  DELETE FROM artists WHERE id = source_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION merge_artists(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION merge_artists(UUID, UUID) TO authenticated;

-- 4. Merge Venues RPC
CREATE OR REPLACE FUNCTION merge_venues(source_id UUID, target_id UUID) 
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF public.get_user_role(auth.uid()) NOT IN ('admin', 'moderador') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING HINT = 'Only admins and moderators can merge entities';
  END IF;

  -- Reassign events
  UPDATE events SET venue_id = target_id WHERE venue_id = source_id;

  -- Delete the source venue
  DELETE FROM venues WHERE id = source_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION merge_venues(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION merge_venues(UUID, UUID) TO authenticated;

-- 5. Merge Events RPC
CREATE OR REPLACE FUNCTION merge_events(source_id UUID, target_id UUID) 
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF public.get_user_role(auth.uid()) NOT IN ('admin', 'moderador') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING HINT = 'Only admins and moderators can merge entities';
  END IF;

  -- Reassign photos
  UPDATE event_photos SET event_id = target_id WHERE event_id = source_id;

  -- Reassign attendance, handling duplicates
  UPDATE attendance a1
  SET event_id = target_id
  WHERE event_id = source_id
    AND NOT EXISTS (
      SELECT 1 FROM attendance a2 WHERE a2.event_id = target_id AND a2.user_id = a1.user_id
    );
  DELETE FROM attendance WHERE event_id = source_id;

  -- Reassign lineups, handling duplicates
  UPDATE lineups ea1
  SET event_id = target_id
  WHERE event_id = source_id
    AND NOT EXISTS (
      SELECT 1 FROM lineups ea2 WHERE ea2.event_id = target_id AND ea2.artist_id = ea1.artist_id
    );
  DELETE FROM lineups WHERE event_id = source_id;

  -- Delete the source event
  DELETE FROM events WHERE id = source_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION merge_events(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION merge_events(UUID, UUID) TO authenticated;
