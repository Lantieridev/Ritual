-- Perfiles de usuario
-- Se crea automáticamente cuando un usuario se registra en Supabase Auth
create table if not exists "public"."profiles" (
  "id" uuid not null references auth.users on delete cascade,
  "username" text unique,
  "full_name" text,
  "avatar_url" text,
  "bio" text,
  "updated_at" timestamp with time zone default now(),
  constraint "profiles_pkey" primary key ("id"),
  constraint "username_length" check (char_length(username) >= 3)
);

alter table "public"."profiles" enable row level security;

-- Políticas de RLS para perfiles
create policy "Los perfiles son públicos"
  on "public"."profiles" for select
  using (true);

create policy "Los usuarios pueden actualizar su propio perfil"
  on "public"."profiles" for update
  using (auth.uid() = id);

-- Trigger para crear perfil al registrarse
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    lower(split_part(new.email, '@', 1)), -- username default basado en email
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Actualizar RLS de tablas existentes para usar auth.uid()
-- Nota: Esto asume que las tablas tienen una columna 'user_id'. 
-- Si no la tienen (ej. attendance, wishlist), se asume que la data es personal.

-- Wishlist
drop policy if exists "Public select wishlist" on public.wishlist;
create policy "Usuarios ven su propia wishlist"
  on public.wishlist for select
  using (auth.uid() = user_id);

drop policy if exists "Public insert wishlist" on public.wishlist;
create policy "Usuarios agregan a su propia wishlist"
  on public.wishlist for insert
  with check (auth.uid() = user_id);

drop policy if exists "Public delete wishlist" on public.wishlist;
create policy "Usuarios borran de su propia wishlist"
  on public.wishlist for delete
  using (auth.uid() = user_id);

-- Attendance (Asistencia)
drop policy if exists "Public select attendance" on public.attendance;
create policy "Usuarios ven su propia asistencia"
  on public.attendance for select
  using (auth.uid() = user_id);

drop policy if exists "Public insert attendance" on public.attendance;
create policy "Usuarios registran su asistencia"
  on public.attendance for insert
  with check (auth.uid() = user_id);

drop policy if exists "Public update attendance" on public.attendance;
create policy "Usuarios actualizan su asistencia"
  on public.attendance for update
  using (auth.uid() = user_id);

-- Foto uploads (Storage ya tiene sus políticas en objects, pero la tabla event_photos necesita RLS)
-- (La tabla event_photos no tiene user_id actualmente, habría que agregarlo si queremos privacidad estricta)
-- Por ahora la dejamos pública o agregamos la columna.
