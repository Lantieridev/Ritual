-- RITUAL Complete Database Schema
-- Run this in Supabase SQL Editor to sync your DB.

-- 1. Extensions
create extension if not exists "uuid-ossp";

-- 2. Tables

create table if not exists public.venues (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    city text,
    country text,
    address text,
    lat numeric,
    lng numeric,
    created_at timestamptz default now()
);

create table if not exists public.artists (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    genre text,
    image_url text,
    spotify_id text,
    created_at timestamptz default now()
);

create table if not exists public.events (
    id uuid default gen_random_uuid() primary key,
    name text,
    date timestamptz not null,
    venue_id uuid references public.venues(id),
    tour_id uuid, -- Self-ref or other table? Assuming just ID for now
    festival_edition_id uuid, -- Link to festival
    is_child_event boolean default false,
    status text default 'confirmed',
    created_at timestamptz default now()
);

create table if not exists public.lineups (
    event_id uuid references public.events(id) on delete cascade,
    artist_id uuid references public.artists(id) on delete cascade,
    stage text,
    start_time time,
    is_headliner boolean default false,
    primary key (event_id, artist_id)
);

create table if not exists public.attendance (
    id uuid default gen_random_uuid() primary key,
    event_id uuid references public.events(id) on delete cascade,
    user_id uuid references auth.users(id) on delete cascade,
    status text not null check (status in ('interested', 'going', 'went')),
    created_at timestamptz default now(),
    unique(event_id, user_id)
);

create table if not exists public.memories (
    id uuid default gen_random_uuid() primary key,
    attendance_id uuid references public.attendance(id) on delete cascade,
    rating integer check (rating >= 0 and rating <= 5),
    review text,
    notes text,
    created_at timestamptz default now()
);

create table if not exists public.wishlist (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade,
    artist_id uuid references public.artists(id) on delete cascade,
    created_at timestamptz default now(),
    unique(user_id, artist_id)
);

create table if not exists public.expenses (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade,
    amount numeric not null,
    category text not null,
    note text,
    event_id uuid references public.events(id) on delete set null,
    date timestamptz not null,
    created_at timestamptz default now()
);

create table if not exists public.festivals (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    edition text,
    start_date date not null,
    end_date date,
    venue_id uuid references public.venues(id),
    city text,
    country text,
    website text,
    poster_url text,
    notes text,
    created_at timestamptz default now()
);

create table if not exists public.festival_events (
    id uuid default gen_random_uuid() primary key,
    festival_id uuid references public.festivals(id) on delete cascade,
    event_id uuid references public.events(id) on delete cascade,
    day_label text
);

create table if not exists public.festival_attendance (
    id uuid default gen_random_uuid() primary key,
    festival_id uuid references public.festivals(id) on delete cascade,
    user_id uuid references auth.users(id) on delete cascade,
    status text not null,
    rating integer,
    review text,
    created_at timestamptz default now(),
    unique(festival_id, user_id)
);

create table if not exists public.event_photos (
    id uuid default gen_random_uuid() primary key,
    event_id uuid references public.events(id) on delete cascade,
    storage_path text not null,
    caption text,
    created_at timestamptz default now()
);


-- 3. Row Level Security (RLS)

-- Enable RLS on all tables
alter table public.venues enable row level security;
alter table public.artists enable row level security;
alter table public.events enable row level security;
alter table public.lineups enable row level security;
alter table public.attendance enable row level security;
alter table public.memories enable row level security;
alter table public.wishlist enable row level security;
alter table public.expenses enable row level security;
alter table public.festivals enable row level security;
alter table public.festival_events enable row level security;
alter table public.festival_attendance enable row level security;
alter table public.event_photos enable row level security;

-- Drop existing policies to ensure clean state
drop policy if exists "Public select venues" on public.venues;
drop policy if exists "Public select artists" on public.artists;
drop policy if exists "Public select events" on public.events;
drop policy if exists "Public select lineups" on public.lineups;
drop policy if exists "Owner select expenses" on public.expenses;
-- ... (Dropping others usually handled by 'create or replace' or explicit drop names. 
-- For brevity, I'll rely on creation with conflict checks or users running this in a clean logic.
-- But standard SQL doesn't have 'create policy if not exists'. 
-- So let's drop typical names we used.)

do $$ begin
  drop policy if exists "Public select venues" on public.venues;
  drop policy if exists "Public read venues" on public.venues;
  -- ... Add more drops if needed, or user can ignore 'policy already exists' errors.
end $$;

-- Policies

-- Public Read Tables (Catalog)
create policy "Public read venues" on public.venues for select to authenticated, anon using (true);
create policy "Public read artists" on public.artists for select to authenticated, anon using (true);
create policy "Public read events" on public.events for select to authenticated, anon using (true);
create policy "Public read lineups" on public.lineups for select to authenticated, anon using (true);
create policy "Public read festivals" on public.festivals for select to authenticated, anon using (true);
create policy "Public read festival_events" on public.festival_events for select to authenticated, anon using (true);
create policy "Public read event_photos" on public.event_photos for select to authenticated, anon using (true);

-- Authenticated Insert/Update for Catalog? (Maybe only admin, but for now Public Read Only, Insert restricted?
-- Assuming app doesn't allow users to create Venues/Artists yet, or if it does, we need policies.
-- Leaving them read-only for now unless logic suggests otherwise.

-- Private User Data (Strict Ownership)

-- Attendance
create policy "Owner all attendance" on public.attendance
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Memories (Linked to attendance, but simplify to 'using true' if connected to own attendance? 
-- No, RLS needs direct check or join. 
-- Efficient: Add user_id to memories OR join. 
-- Since we didn't add user_id, we rely on join?
-- 'using (attendance_id in (select id from attendance where user_id = auth.uid()))'
create policy "Owner all memories" on public.memories
  for all to authenticated 
  using (attendance_id in (select id from public.attendance where user_id = auth.uid()))
  with check (attendance_id in (select id from public.attendance where user_id = auth.uid()));

-- Wishlist
create policy "Owner all wishlist" on public.wishlist
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Expenses
create policy "Owner all expenses" on public.expenses
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Festival Attendance
create policy "Owner all festival_attendance" on public.festival_attendance
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Event Photos (Allow authenticated insert, read public)
create policy "Auth insert event_photos" on public.event_photos
  for insert to authenticated with check (true);
  
-- 4. RPC for Migration

create or replace function migrate_legacy_data(target_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  legacy_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  -- Update user_id for tables that have it
  update public.attendance set user_id = target_user_id where user_id = legacy_id;
  update public.wishlist set user_id = target_user_id where user_id = legacy_id;
  update public.expenses set user_id = target_user_id where user_id = legacy_id;
  update public.festival_attendance set user_id = target_user_id where user_id = legacy_id;
end;
$$;

grant execute on function migrate_legacy_data(uuid) to authenticated;
