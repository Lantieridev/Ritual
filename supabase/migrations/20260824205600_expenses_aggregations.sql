-- RPC for getExpensesSummary
CREATE OR REPLACE FUNCTION get_expenses_summary(user_uuid uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
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
$$;

-- RPC for getVenueArtistSpendEstimate
CREATE OR REPLACE FUNCTION get_venue_artist_spend_estimate(
  p_user_id uuid,
  p_venue_id uuid,
  p_artist_ids uuid[],
  p_exclude_event_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  v_average numeric;
  v_count integer;
BEGIN
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
$$;
