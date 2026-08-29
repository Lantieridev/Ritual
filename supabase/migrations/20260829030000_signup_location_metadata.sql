-- handle_new_user() ya lee full_name/avatar_url de raw_user_meta_data al
-- crear la fila de profiles en el signup. Se suma location al mismo INSERT
-- (issue #55) en vez de un UPDATE aparte después del signUp: ese UPDATE
-- correría sin sesión activa en cualquier proyecto con confirmación de
-- email habilitada (signUp() no deja sesión hasta confirmar), y fallaría en
-- silencio contra la policy "auth.uid() = id" de profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url, location)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'location'
  );
  return new;
end;
$$;
