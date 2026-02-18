-- Soporte de Festivales
-- Un festival agrupa múltiples eventos bajo un nombre/edición.
-- Ejemplo: Lollapalooza Argentina 2024 → múltiples días con distintos artistas.

create table if not exists "public"."festivals" (
  "id" uuid not null default extensions.uuid_generate_v4(),
  "name" text not null,
  "edition" text,                          -- ej. "2024", "Edición 10"
  "start_date" date not null,
  "end_date" date,
  "venue_id" uuid references public.venues(id) on delete set null,
  "city" text,
  "country" text,
  "website" text,
  "poster_url" text,
  "notes" text,
  "created_at" timestamp with time zone default now(),
  constraint "festivals_pkey" primary key ("id")
);

alter table "public"."festivals" enable row level security;

create policy "Public select festivals"
  on "public"."festivals" as permissive for select to public using (true);

create policy "Public insert festivals"
  on "public"."festivals" as permissive for insert to public with check (true);

create policy "Public update festivals"
  on "public"."festivals" as permissive for update to public using (true);

create policy "Public delete festivals"
  on "public"."festivals" as permissive for delete to public using (true);

-- Relación festival ↔ eventos (un festival puede tener múltiples días/eventos)
create table if not exists "public"."festival_events" (
  "id" uuid not null default extensions.uuid_generate_v4(),
  "festival_id" uuid not null references public.festivals(id) on delete cascade,
  "event_id" uuid not null references public.events(id) on delete cascade,
  "day_label" text,                        -- ej. "Día 1", "Viernes"
  constraint "festival_events_pkey" primary key ("id"),
  constraint "festival_events_unique" unique ("festival_id", "event_id")
);

alter table "public"."festival_events" enable row level security;

create policy "Public select festival_events"
  on "public"."festival_events" as permissive for select to public using (true);

create policy "Public insert festival_events"
  on "public"."festival_events" as permissive for insert to public with check (true);

create policy "Public delete festival_events"
  on "public"."festival_events" as permissive for delete to public using (true);

-- Attendance del usuario al festival completo
create table if not exists "public"."festival_attendance" (
  "id" uuid not null default extensions.uuid_generate_v4(),
  "festival_id" uuid not null references public.festivals(id) on delete cascade,
  "user_id" uuid not null,
  "status" text not null default 'interested' check (status in ('interested', 'going', 'went')),
  "rating" smallint check (rating between 1 and 5),
  "review" text,
  "created_at" timestamp with time zone default now(),
  constraint "festival_attendance_pkey" primary key ("id"),
  constraint "festival_attendance_user_festival_unique" unique ("user_id", "festival_id")
);

alter table "public"."festival_attendance" enable row level security;

create policy "Public select festival_attendance"
  on "public"."festival_attendance" as permissive for select to public using (true);

create policy "Public insert festival_attendance"
  on "public"."festival_attendance" as permissive for insert to public with check (true);

create policy "Public update festival_attendance"
  on "public"."festival_attendance" as permissive for update to public using (true);

create policy "Public delete festival_attendance"
  on "public"."festival_attendance" as permissive for delete to public using (true);
