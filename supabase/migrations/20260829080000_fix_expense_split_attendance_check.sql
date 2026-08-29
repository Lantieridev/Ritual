-- Bug real, encontrado probando la feature en vivo: addExpenseSplit chequea
-- si el usuario tageado tiene asistencia marcada en el evento consultando
-- la tabla attendance con la sesión del usuario que está compartiendo el
-- gasto. La única policy de attendance ("Owner manages own attendance")
-- sólo deja ver la fila propia -- la consulta siempre devuelve null para
-- la asistencia de otra persona, exista o no, y la feature de compartir
-- rechaza a cualquier usuario real.
--
-- Mismo arreglo que is_moderator()/owns_expense(): una función
-- SECURITY DEFINER que resuelve el chequeo como el dueño de la tabla,
-- sin reabrir RLS.
create or replace function public.user_attends_event(check_event_id uuid, check_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.attendance
    where event_id = check_event_id and user_id = check_user_id
  );
$$;

revoke execute on function public.user_attends_event(uuid, uuid) from public;
grant execute on function public.user_attends_event(uuid, uuid) to authenticated;
