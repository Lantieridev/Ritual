-- Galería de fotos por evento
-- Tabla para almacenar referencias a fotos subidas a Supabase Storage

create table if not exists "public"."event_photos" (
  "id" uuid not null default extensions.uuid_generate_v4(),
  "event_id" uuid not null references public.events(id) on delete cascade,
  "storage_path" text not null,
  "caption" text,
  "created_at" timestamp with time zone default now()
);

alter table "public"."event_photos" enable row level security;

alter table "public"."event_photos"
  add constraint "event_photos_pkey" primary key ("id");

-- Políticas permisivas (single-player, igual que attendance/memories)
create policy "Public select event_photos"
  on "public"."event_photos" as permissive for select to public using (true);

create policy "Public insert event_photos"
  on "public"."event_photos" as permissive for insert to public with check (true);

create policy "Public delete event_photos"
  on "public"."event_photos" as permissive for delete to public using (true);

-- Notas/setlist manual en memories
alter table "public"."memories"
  add column if not exists "notes" text;

-- Wishlist de artistas
create table if not exists "public"."wishlist" (
  "id" uuid not null default extensions.uuid_generate_v4(),
  "user_id" uuid not null,
  "artist_id" uuid not null references public.artists(id) on delete cascade,
  "created_at" timestamp with time zone default now(),
  constraint "wishlist_pkey" primary key ("id"),
  constraint "wishlist_user_artist_unique" unique ("user_id", "artist_id")
);

alter table "public"."wishlist" enable row level security;

create policy "Public select wishlist"
  on "public"."wishlist" as permissive for select to public using (true);

create policy "Public insert wishlist"
  on "public"."wishlist" as permissive for insert to public with check (true);

create policy "Public delete wishlist"
  on "public"."wishlist" as permissive for delete to public using (true);
