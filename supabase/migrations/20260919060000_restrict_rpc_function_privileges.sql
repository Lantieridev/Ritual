-- Endurece las funciones SECURITY DEFINER expuestas por PostgREST (/rest/v1/rpc/...).
--
-- Verificado contra la base real:
--   * get_expenses_summary(user_uuid) y get_venue_artist_spend_estimate(p_user_id, ...)
--     son SECURITY DEFINER (saltan RLS), reciben el id del usuario como parámetro
--     SIN compararlo con auth.uid(), y eran ejecutables por `anon` (EXECUTE viene
--     de PUBLIC por defecto). Con sólo la anon key pública, cualquiera podía leer
--     el gasto total, la cantidad y el desglose de CUALQUIER usuario conociendo su
--     id (profiles es de lectura pública, así que los ids se pueden obtener).
--   * get_user_role(user_id) dejaba consultar el rol de cualquiera sin sesión.
--   * Las funciones de trigger (handle_new_user, check_creation_rate_limit,
--     enforce_status_change_privilege, seed_default_checklist_template) eran
--     invocables como RPC. Nunca deben serlo: sólo las dispara un trigger.
--
-- No se toca user_attends_event: la app la llama con el id de OTRO usuario (chequeo
-- de gastos compartidos) y su restricción requiere un cambio de diseño aparte.

-- 1. Funciones de trigger: fuera de la API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.check_creation_rate_limit() from public, anon, authenticated;
revoke execute on function public.enforce_status_change_privilege() from public, anon, authenticated;
revoke execute on function public.seed_default_checklist_template() from public, anon, authenticated;

-- 2. get_expenses_summary: sólo el dueño puede pedir su propio resumen.
create or replace function public.get_expenses_summary(user_uuid uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  result json;
BEGIN
  -- IS DISTINCT FROM: auth.uid() es NULL sin sesión y un `!=` común dejaría pasar.
  IF user_uuid IS DISTINCT FROM (select auth.uid()) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING HINT = 'Only the owner can read this summary';
  END IF;

  SELECT json_build_object(
    'total', COALESCE(SUM(amount), 0),
    'count', COUNT(*),
    'byCategory', COALESCE((
      SELECT json_object_agg(category, cat_total)
      FROM (
        SELECT COALESCE(category, 'Otro') as category, SUM(amount) as cat_total
        FROM expenses
        WHERE user_id = user_uuid
        GROUP BY COALESCE(category, 'Otro')
      ) sub
    ), '{}'::json),
    'byYear', COALESCE((
      SELECT json_object_agg(year_str, year_total)
      FROM (
        SELECT EXTRACT(YEAR FROM date)::text as year_str, SUM(amount) as year_total
        FROM expenses
        WHERE user_id = user_uuid
        GROUP BY EXTRACT(YEAR FROM date)::text
      ) sub2
    ), '{}'::json)
  ) INTO result
  FROM expenses
  WHERE user_id = user_uuid;

  RETURN result;
END;
$function$;

-- 3. get_venue_artist_spend_estimate: mismo criterio.
create or replace function public.get_venue_artist_spend_estimate(
  p_user_id uuid,
  p_venue_id uuid,
  p_artist_ids uuid[],
  p_exclude_event_id uuid
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  result json;
  v_average numeric;
  v_count integer;
BEGIN
  IF p_user_id IS DISTINCT FROM (select auth.uid()) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING HINT = 'Only the owner can read this estimate';
  END IF;

  WITH matching_events AS (
    SELECT id as event_id
    FROM events
    WHERE p_venue_id IS NOT NULL
      AND venue_id = p_venue_id
      AND id != p_exclude_event_id
    UNION
    SELECT event_id
    FROM lineups
    WHERE p_artist_ids IS NOT NULL
      AND cardinality(p_artist_ids) > 0
      AND artist_id = ANY(p_artist_ids)
      AND event_id != p_exclude_event_id
  ),
  event_totals AS (
    SELECT e.event_id, SUM(ex.amount) as total_amount
    FROM matching_events e
    JOIN expenses ex ON ex.event_id = e.event_id
    WHERE ex.user_id = p_user_id
    GROUP BY e.event_id
  )
  SELECT
    AVG(total_amount),
    COUNT(*)
  INTO v_average, v_count
  FROM event_totals;

  IF v_count = 0 OR v_count IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'averageTotal', v_average,
    'eventsConsidered', v_count
  );
END;
$function$;

-- 4. Las funciones anteriores y get_user_role: sólo usuarios con sesión.
-- EXECUTE llega a `anon` por PUBLIC, así que se revoca de PUBLIC y se concede explícito.
revoke execute on function public.get_expenses_summary(uuid) from public, anon;
revoke execute on function public.get_venue_artist_spend_estimate(uuid, uuid, uuid[], uuid) from public, anon;
revoke execute on function public.get_user_role(uuid) from public, anon;

grant execute on function public.get_expenses_summary(uuid) to authenticated, service_role;
grant execute on function public.get_venue_artist_spend_estimate(uuid, uuid, uuid[], uuid) to authenticated, service_role;
grant execute on function public.get_user_role(uuid) to authenticated, service_role;
