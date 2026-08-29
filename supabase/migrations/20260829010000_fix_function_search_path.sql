-- Tres funciones SECURITY DEFINER quedaron sin `search_path` fijo: sin esto,
-- un rol con permiso de CREATE en algún schema que precede a `public` en el
-- search_path del llamador podría crear una función o tabla que haga sombra
-- a una referencia sin calificar dentro del cuerpo, y estas corren con los
-- privilegios de su dueño, no los del caller.
--
-- `ALTER FUNCTION ... SET search_path` no toca el cuerpo ni la firma, así que
-- no hay riesgo de cambiar el comportamiento — sólo fija la resolución de
-- nombres.
alter function public.get_expenses_summary(uuid) set search_path = public;
alter function public.get_venue_artist_spend_estimate(uuid, uuid, uuid[], uuid) set search_path = public;
alter function public.handle_new_user() set search_path = public;
