-- Comentarios en recitales (Portales)
create table if not exists "public"."comments" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null references auth.users on delete cascade,
  "event_id" uuid not null references public.events on delete cascade,
  "content" text not null,
  "created_at" timestamp with time zone default now() not null,
  constraint "comments_pkey" primary key ("id")
);

alter table "public"."comments" enable row level security;

-- Políticas de RLS para comentarios
create policy "Los comentarios son públicos"
  on "public"."comments" for select
  using (true);

create policy "Los usuarios registrados pueden comentar"
  on "public"."comments" for insert
  with check (auth.uid() = user_id);

create policy "Los usuarios pueden borrar sus propios comentarios"
  on "public"."comments" for delete
  using (auth.uid() = user_id);

-- Crear índices para performance
create index if not exists "comments_event_id_idx" on "public"."comments" ("event_id");
create index if not exists "comments_user_id_idx" on "public"."comments" ("user_id");
