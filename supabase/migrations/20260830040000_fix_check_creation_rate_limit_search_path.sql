-- Encontrado por revisión externa (agy) y verificado contra la DB en vivo:
-- check_creation_rate_limit() es SECURITY DEFINER sin `search_path` fijado
-- -se escapó de la tanda de fixes de get_expenses_summary/
-- get_venue_artist_spend_estimate/handle_new_user en
-- 20260829010000_fix_function_search_path.sql. Mismo riesgo de
-- search_path hijacking: sin esto, un objeto con el mismo nombre en un
-- schema que aparezca antes en el search_path de quien ejecuta la
-- función podría interceptar la llamada dinámica a `format()`/EXECUTE de
-- adentro.
alter function public.check_creation_rate_limit() set search_path = public;
