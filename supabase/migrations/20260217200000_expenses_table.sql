-- Gastos personales (no compartidos con otros usuarios).
-- RLS: cada usuario solo ve/edita/borra los suyos (user_id = auth.uid()).

create table public.expenses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  amount decimal(12, 2) not null check (amount > 0),
  category text not null,
  note text,
  event_id uuid references public.events(id) on delete set null,
  date date not null default current_date,
  created_at timestamptz default now()
);

alter table public.expenses enable row level security;

create policy "Users see own expenses"
  on public.expenses for select
  using (auth.uid() = user_id);

create policy "Users insert own expenses"
  on public.expenses for insert
  with check (auth.uid() = user_id);

create policy "Users update own expenses"
  on public.expenses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own expenses"
  on public.expenses for delete
  using (auth.uid() = user_id);

create index expenses_user_id_date_idx on public.expenses (user_id, date desc);
