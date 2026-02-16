drop extension if exists "pg_net";

create extension if not exists "postgis" with schema "public";

create type "public"."attendance_status" as enum ('interested', 'going', 'went');


  create table "public"."artists" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "name" text not null,
    "genre" text,
    "image_url" text,
    "spotify_id" text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."artists" enable row level security;


  create table "public"."attendance" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" uuid not null,
    "event_id" uuid not null,
    "status" public.attendance_status default 'interested'::public.attendance_status,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."attendance" enable row level security;


  create table "public"."events" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "name" text,
    "date" timestamp with time zone not null,
    "venue_id" uuid,
    "tour_id" uuid,
    "festival_edition_id" uuid,
    "is_child_event" boolean default false,
    "status" text default 'scheduled'::text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."events" enable row level security;


  create table "public"."festival_editions" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "festival_id" uuid not null,
    "year" integer not null,
    "name" text,
    "start_date" date,
    "end_date" date,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."festival_editions" enable row level security;


  create table "public"."festivals" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "name" text not null,
    "description" text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."festivals" enable row level security;


  create table "public"."lineups" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "event_id" uuid not null,
    "artist_id" uuid not null,
    "stage" text,
    "start_time" time without time zone,
    "is_headliner" boolean default false
      );


alter table "public"."lineups" enable row level security;


  create table "public"."memories" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "attendance_id" uuid not null,
    "rating" integer,
    "review" text,
    "media_urls" text[],
    "created_at" timestamp with time zone default now()
      );


alter table "public"."memories" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "username" text,
    "avatar_url" text,
    "bio" text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."profiles" enable row level security;


  create table "public"."tours" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "artist_id" uuid not null,
    "name" text not null,
    "year" integer,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."tours" enable row level security;


  create table "public"."venues" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "name" text not null,
    "address" text,
    "city" text,
    "country" text,
    "lat" double precision,
    "lng" double precision,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."venues" enable row level security;

CREATE UNIQUE INDEX artists_pkey ON public.artists USING btree (id);

CREATE UNIQUE INDEX attendance_pkey ON public.attendance USING btree (id);

CREATE UNIQUE INDEX attendance_user_id_event_id_key ON public.attendance USING btree (user_id, event_id);

CREATE UNIQUE INDEX events_pkey ON public.events USING btree (id);

CREATE UNIQUE INDEX festival_editions_pkey ON public.festival_editions USING btree (id);

CREATE UNIQUE INDEX festivals_pkey ON public.festivals USING btree (id);

CREATE UNIQUE INDEX lineups_event_id_artist_id_key ON public.lineups USING btree (event_id, artist_id);

CREATE UNIQUE INDEX lineups_pkey ON public.lineups USING btree (id);

CREATE UNIQUE INDEX memories_pkey ON public.memories USING btree (id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX profiles_username_key ON public.profiles USING btree (username);

CREATE UNIQUE INDEX tours_pkey ON public.tours USING btree (id);

CREATE UNIQUE INDEX venues_pkey ON public.venues USING btree (id);

alter table "public"."artists" add constraint "artists_pkey" PRIMARY KEY using index "artists_pkey";

alter table "public"."attendance" add constraint "attendance_pkey" PRIMARY KEY using index "attendance_pkey";

alter table "public"."events" add constraint "events_pkey" PRIMARY KEY using index "events_pkey";

alter table "public"."festival_editions" add constraint "festival_editions_pkey" PRIMARY KEY using index "festival_editions_pkey";

alter table "public"."festivals" add constraint "festivals_pkey" PRIMARY KEY using index "festivals_pkey";

alter table "public"."lineups" add constraint "lineups_pkey" PRIMARY KEY using index "lineups_pkey";

alter table "public"."memories" add constraint "memories_pkey" PRIMARY KEY using index "memories_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."tours" add constraint "tours_pkey" PRIMARY KEY using index "tours_pkey";

alter table "public"."venues" add constraint "venues_pkey" PRIMARY KEY using index "venues_pkey";

alter table "public"."attendance" add constraint "attendance_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.events(id) not valid;

alter table "public"."attendance" validate constraint "attendance_event_id_fkey";

alter table "public"."attendance" add constraint "attendance_user_id_event_id_key" UNIQUE using index "attendance_user_id_event_id_key";

alter table "public"."attendance" add constraint "attendance_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) not valid;

alter table "public"."attendance" validate constraint "attendance_user_id_fkey";

alter table "public"."events" add constraint "events_festival_edition_id_fkey" FOREIGN KEY (festival_edition_id) REFERENCES public.festival_editions(id) not valid;

alter table "public"."events" validate constraint "events_festival_edition_id_fkey";

alter table "public"."events" add constraint "events_tour_id_fkey" FOREIGN KEY (tour_id) REFERENCES public.tours(id) not valid;

alter table "public"."events" validate constraint "events_tour_id_fkey";

alter table "public"."events" add constraint "events_venue_id_fkey" FOREIGN KEY (venue_id) REFERENCES public.venues(id) not valid;

alter table "public"."events" validate constraint "events_venue_id_fkey";

alter table "public"."festival_editions" add constraint "festival_editions_festival_id_fkey" FOREIGN KEY (festival_id) REFERENCES public.festivals(id) not valid;

alter table "public"."festival_editions" validate constraint "festival_editions_festival_id_fkey";

alter table "public"."lineups" add constraint "lineups_artist_id_fkey" FOREIGN KEY (artist_id) REFERENCES public.artists(id) not valid;

alter table "public"."lineups" validate constraint "lineups_artist_id_fkey";

alter table "public"."lineups" add constraint "lineups_event_id_artist_id_key" UNIQUE using index "lineups_event_id_artist_id_key";

alter table "public"."lineups" add constraint "lineups_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.events(id) not valid;

alter table "public"."lineups" validate constraint "lineups_event_id_fkey";

alter table "public"."memories" add constraint "memories_attendance_id_fkey" FOREIGN KEY (attendance_id) REFERENCES public.attendance(id) not valid;

alter table "public"."memories" validate constraint "memories_attendance_id_fkey";

alter table "public"."memories" add constraint "memories_rating_check" CHECK (((rating >= 1) AND (rating <= 5))) not valid;

alter table "public"."memories" validate constraint "memories_rating_check";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."profiles" add constraint "profiles_username_key" UNIQUE using index "profiles_username_key";

alter table "public"."tours" add constraint "tours_artist_id_fkey" FOREIGN KEY (artist_id) REFERENCES public.artists(id) not valid;

alter table "public"."tours" validate constraint "tours_artist_id_fkey";

set check_function_bodies = off;

create type "public"."geometry_dump" as ("path" integer[], "geom" public.geometry);

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (id, username, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$function$
;

create type "public"."valid_detail" as ("valid" boolean, "reason" character varying, "location" public.geometry);


  create policy "Public artists"
  on "public"."artists"
  as permissive
  for select
  to public
using (true);



  create policy "Manage own attendance"
  on "public"."attendance"
  as permissive
  for all
  to public
using ((auth.uid() = user_id));



  create policy "View own attendance"
  on "public"."attendance"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Allow insert events"
  on "public"."events"
  as permissive
  for insert
  to public
with check (true);



  create policy "Public events"
  on "public"."events"
  as permissive
  for select
  to public
using (true);



  create policy "Public festival_editions"
  on "public"."festival_editions"
  as permissive
  for select
  to public
using (true);



  create policy "Public festivals"
  on "public"."festivals"
  as permissive
  for select
  to public
using (true);



  create policy "Public lineups"
  on "public"."lineups"
  as permissive
  for select
  to public
using (true);



  create policy "Manage own memories"
  on "public"."memories"
  as permissive
  for insert
  to public
with check ((attendance_id IN ( SELECT attendance.id
   FROM public.attendance
  WHERE (attendance.user_id = auth.uid()))));



  create policy "View own memories"
  on "public"."memories"
  as permissive
  for select
  to public
using ((attendance_id IN ( SELECT attendance.id
   FROM public.attendance
  WHERE (attendance.user_id = auth.uid()))));



  create policy "Public profiles"
  on "public"."profiles"
  as permissive
  for select
  to public
using (true);



  create policy "Users update own profile"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((auth.uid() = id));



  create policy "Public tours"
  on "public"."tours"
  as permissive
  for select
  to public
using (true);



  create policy "Public venues"
  on "public"."venues"
  as permissive
  for select
  to public
using (true);


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


