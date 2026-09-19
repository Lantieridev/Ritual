-- merge_events() movía event_photos, attendance y lineups al evento destino,
-- pero no expenses, festival_events, event_checklist_items ni
-- event_checklist_checks. Ninguna de esas filas levanta excepción al borrar el
-- evento origen, así que el merge "salía bien" y perdía datos en silencio:
--
--   expenses.event_id                ON DELETE SET NULL -> el gasto queda sin show
--   festival_events.event_id         ON DELETE CASCADE  -> el show sale del festival
--   event_checklist_items.event_id   ON DELETE CASCADE  -> se borra el checklist
--   event_checklist_checks.event_id  ON DELETE CASCADE  -> se pierde lo tildado
--
-- Ahora las cuatro se mueven al destino antes del DELETE. Donde hay unique
-- (festival_events por festival, checks por usuario + ítem de plantilla) se
-- mueve sólo lo que el destino no tiene; el resto es duplicado y cae por el
-- cascade del DELETE del origen. expenses y event_checklist_items no tienen
-- unique sobre event_id: se mueven completos.
--
-- Es CREATE OR REPLACE del cuerpo de 20260825060000: los GRANT/REVOKE de la
-- función se conservan y el guard de moderador queda igual.

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

  UPDATE expenses SET event_id = target_id WHERE event_id = source_id;

  UPDATE festival_events fe1
  SET event_id = target_id
  WHERE event_id = source_id
    AND NOT EXISTS (
      SELECT 1 FROM festival_events fe2
      WHERE fe2.event_id = target_id AND fe2.festival_id = fe1.festival_id
    );

  UPDATE event_checklist_items SET event_id = target_id WHERE event_id = source_id;

  UPDATE event_checklist_checks c1
  SET event_id = target_id
  WHERE event_id = source_id
    AND NOT EXISTS (
      SELECT 1 FROM event_checklist_checks c2
      WHERE c2.event_id = target_id
        AND c2.user_id = c1.user_id
        AND c2.template_item_id = c1.template_item_id
    );

  DELETE FROM events WHERE id = source_id;
END;
$$;
