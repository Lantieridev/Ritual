-- Cierra el camino de aprobación de la cola de moderación.
--
-- Antes de esto, approveArtist/Venue/Event hacían un UPDATE directo con el
-- cliente de @supabase/ssr, que corre con el JWT del usuario:
--
--   * `artists` y `venues` no tienen ninguna policy de UPDATE, así que RLS
--     denegaba. PostgREST responde a un UPDATE bloqueado por RLS afectando 0
--     filas y devolviendo error null, no un error — la aprobación fallaba en
--     silencio y el resolver reportaba success.
--   * `events` sí tiene "Allow update events" con `using (true)`, necesaria
--     para la edición legítima de recitales, así que ahí el UPDATE pasaba y
--     cualquier autenticado podía auto-aprobarse un evento pegándole directo a
--     PostgREST, salteando el guard de rol de GraphQL.

-- ─── 1. Chequeo de rol NULL-safe, compartido ────────────────────────────────
-- get_user_role() devuelve NULL cuando el usuario no tiene fila en profiles.
-- `NULL IN ('admin','moderador')` es NULL, y `IF NULL THEN` es falsy en
-- plpgsql, así que un chequeo escrito como `IF get_user_role(...) NOT IN (...)`
-- se saltea y deja pasar la operación. Es el mismo trap que ya documenta
-- assign_user_role() en 20260823202400_user_roles.sql, resuelto una sola vez
-- acá para que los merge, el approve y el trigger compartan la misma semántica.

CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT coalesce(public.get_user_role(auth.uid()) IN ('admin', 'moderador'), false);
$$;

REVOKE EXECUTE ON FUNCTION public.is_moderator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_moderator() TO authenticated;

-- ─── 2. Los merge existentes pasan al chequeo NULL-safe ─────────────────────
-- Sólo cambia la guarda de privilegio; el cuerpo de cada fusión queda igual
-- que en 20260824202000_moderation_queue.sql.

CREATE OR REPLACE FUNCTION merge_artists(source_id UUID, target_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'insufficient_privilege' USING HINT = 'Only admins and moderators can merge entities';
  END IF;

  UPDATE lineups ea1
  SET artist_id = target_id
  WHERE artist_id = source_id
    AND NOT EXISTS (
      SELECT 1 FROM lineups ea2 WHERE ea2.artist_id = target_id AND ea2.event_id = ea1.event_id
    );
  DELETE FROM lineups WHERE artist_id = source_id;

  UPDATE wishlist w1
  SET artist_id = target_id
  WHERE artist_id = source_id
    AND NOT EXISTS (
      SELECT 1 FROM wishlist w2 WHERE w2.artist_id = target_id AND w2.user_id = w1.user_id
    );
  DELETE FROM wishlist WHERE artist_id = source_id;

  DELETE FROM artists WHERE id = source_id;
END;
$$;

CREATE OR REPLACE FUNCTION merge_venues(source_id UUID, target_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'insufficient_privilege' USING HINT = 'Only admins and moderators can merge entities';
  END IF;

  UPDATE events SET venue_id = target_id WHERE venue_id = source_id;

  DELETE FROM venues WHERE id = source_id;
END;
$$;

CREATE OR REPLACE FUNCTION merge_events(source_id UUID, target_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'insufficient_privilege' USING HINT = 'Only admins and moderators can merge entities';
  END IF;

  UPDATE event_photos SET event_id = target_id WHERE event_id = source_id;

  UPDATE attendance a1
  SET event_id = target_id
  WHERE event_id = source_id
    AND NOT EXISTS (
      SELECT 1 FROM attendance a2 WHERE a2.event_id = target_id AND a2.user_id = a1.user_id
    );
  DELETE FROM attendance WHERE event_id = source_id;

  UPDATE lineups ea1
  SET event_id = target_id
  WHERE event_id = source_id
    AND NOT EXISTS (
      SELECT 1 FROM lineups ea2 WHERE ea2.event_id = target_id AND ea2.artist_id = ea1.artist_id
    );
  DELETE FROM lineups WHERE event_id = source_id;

  DELETE FROM events WHERE id = source_id;
END;
$$;

-- ─── 3. Aprobación por RPC ──────────────────────────────────────────────────
-- SECURITY DEFINER para que la aprobación no dependa de una policy de UPDATE
-- por tabla, igual que los merge. El whitelist de entity_type corre antes del
-- format() y no después: format(%I) escapa el identificador, pero la lista
-- explícita es la que garantiza que sólo se puedan tocar esas tres tablas.

CREATE OR REPLACE FUNCTION public.approve_entity(entity_type text, entity_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'insufficient_privilege' USING HINT = 'Only admins and moderators can approve entities';
  END IF;

  IF entity_type NOT IN ('artists', 'venues', 'events') THEN
    RAISE EXCEPTION 'invalid_entity_type' USING HINT = 'entity_type must be one of artists, venues, events';
  END IF;

  EXECUTE format('UPDATE public.%I SET status = %L WHERE id = $1', entity_type, 'verified')
  USING entity_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_entity(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_entity(text, uuid) TO authenticated;

-- ─── 4. Guard de transiciones de status ─────────────────────────────────────
-- "Allow update events" no se puede arreglar desde la policy: en una policy de
-- UPDATE, USING ve la fila vieja y WITH CHECK la nueva, y no hay forma de
-- correlacionarlas para escribir "permitido salvo que cambie status". El
-- trigger es el único mecanismo que ve OLD y NEW juntos. Se aplica a las tres
-- tablas por simetría, aunque hoy sólo events tenga policy de UPDATE: si
-- mañana se agrega una para artists o venues, la protección ya está puesta.
--
-- Es BEFORE UPDATE únicamente. Las altas que nacen verificadas desde los
-- adapters son INSERT, así que no las toca.

CREATE OR REPLACE FUNCTION public.enforce_status_change_privilege()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT public.is_moderator() THEN
    RAISE EXCEPTION 'insufficient_privilege' USING HINT = 'Only admins and moderators can change verification status';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_artists_status_guard
  BEFORE UPDATE ON artists
  FOR EACH ROW EXECUTE FUNCTION public.enforce_status_change_privilege();

CREATE TRIGGER tr_venues_status_guard
  BEFORE UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION public.enforce_status_change_privilege();

CREATE TRIGGER tr_events_status_guard
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_status_change_privilege();
