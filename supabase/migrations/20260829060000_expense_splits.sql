-- Gastos compartidos ("Crew"), acotados a un evento (issue #58). Split
-- simple por partes iguales entre quien pagó y cada tageado -no resuelve
-- pagos reales, sólo el cálculo y la visibilidad, como pide el propio issue.
create table public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (expense_id, user_id)
);

create index expense_splits_expense_id_idx on public.expense_splits (expense_id);
-- Para el otro sentido: "en qué gastos me tagearon", que arma la vista del
-- lado del tageado (no del dueño del gasto) sin recorrer todos los gastos.
create index expense_splits_user_id_idx on public.expense_splits (user_id);

alter table public.expense_splits enable row level security;

create policy "Owner or tagged user can view expense splits"
  on public.expense_splits
  as permissive
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.expenses
      where expenses.id = expense_splits.expense_id
        and expenses.user_id = (select auth.uid())
    )
  );

-- Sólo quien pagó el gasto puede taggear o sacar gente -- el tageado nunca
-- edita ni borra el split, sólo lo ve (issue #58, criterio de aceptación).
create policy "Expense owner manages splits"
  on public.expense_splits
  as permissive
  for all
  to authenticated
  using (
    exists (
      select 1 from public.expenses
      where expenses.id = expense_splits.expense_id
        and expenses.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.expenses
      where expenses.id = expense_splits.expense_id
        and expenses.user_id = (select auth.uid())
    )
  );

-- Un tageado tiene que poder leer el gasto en sí (monto, categoría, nota),
-- no sólo la fila de expense_splits -- la policy de "Owner manages own
-- expenses" (FOR ALL) no lo cubre porque exige user_id = auth.uid(). Esta
-- se OR-combina con esa: no le suma permiso de editar/borrar a nadie, sólo
-- de leer.
create policy "Tagged users can view shared expenses"
  on public.expenses
  as permissive
  for select
  to authenticated
  using (
    exists (
      select 1 from public.expense_splits
      where expense_splits.expense_id = expenses.id
        and expense_splits.user_id = (select auth.uid())
    )
  );
