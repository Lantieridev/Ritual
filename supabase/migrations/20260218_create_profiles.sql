-- Create a table for public profiles
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade not null primary key,
  username text unique,
  full_name text,
  avatar_url text, -- Storage path or URL
  website text,
  bio text,
  location text,
  updated_at timestamptz,
  constraint username_length check (char_length(username) >= 3)
);

-- Enable RLS
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on public.profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on public.profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on public.profiles for update
  using ( auth.uid() = id );

-- Optional: Create a trigger to create a profile entry when a new user signs up
-- This is often useful, but for now we can rely on manual creation or explicit onboarding.
-- Let's add a trigger for convenience if the user wants "auto-creation".
-- But maybe better to let the app handle it on first visit or signup.
-- We'll skip trigger for now to keep it simple and explicit.
