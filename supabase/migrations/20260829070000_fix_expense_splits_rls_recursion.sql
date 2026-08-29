-- Bug real, encontrado probando la feature en vivo: las policies de
-- expenses y expense_splits se referenciaban entre sí con subqueries
-- correlacionadas directas -- Postgres detecta el ciclo y tira
-- "infinite recursion detected in policy" (42P17) apenas alguien intenta
-- leer expenses con al menos un split de por medio.
--
-- Mismo arreglo que ya usa is_moderator() en este repo: una función
-- SECURITY DEFINER. El dueño de la tabla no dispara RLS sobre su propia
-- tabla, así que la función resuelve el chequeo sin reabrir el ciclo -la
-- policy de afuera ve un boolean opaco, no una tabla con sus propias
-- policies para reevaluar.
create or replace function public.owns_expense(check_expense_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.expenses
    where id = check_expense_id and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_tagged_in_expense(check_expense_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.expense_splits
    where expense_id = check_expense_id and user_id = (select auth.uid())
  );
$$;

revoke execute on function public.owns_expense(uuid) from public;
grant execute on function public.owns_expense(uuid) to authenticated;
revoke execute on function public.is_tagged_in_expense(uuid) from public;
grant execute on function public.is_tagged_in_expense(uuid) to authenticated;

drop policy if exists "Tagged users can view shared expenses" on public.expenses;
create policy "Tagged users can view shared expenses"
  on public.expenses
  as permissive
  for select
  to authenticated
  using (is_tagged_in_expense(id));

drop policy if exists "Owner or tagged user can view expense splits" on public.expense_splits;
create policy "Owner or tagged user can view expense splits"
  on public.expense_splits
  as permissive
  for select
  to authenticated
  using ((select auth.uid()) = user_id or owns_expense(expense_id));

drop policy if exists "Expense owner manages splits" on public.expense_splits;
create policy "Expense owner manages splits"
  on public.expense_splits
  as permissive
  for all
  to authenticated
  using (owns_expense(expense_id))
  with check (owns_expense(expense_id));
