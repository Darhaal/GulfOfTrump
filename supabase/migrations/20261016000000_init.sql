-- Gulf of Trump — initial schema.
--
-- Supabase is optional for the game: it adds Google sign-in and cloud saves.
-- Everything a player stores is theirs alone; row-level security enforces it
-- for every query that comes through the public anon key.

-- ---------------------------------------------------------------------------
-- Profiles: one row per signed-in player, filled from the Google identity.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 200),
  avatar_url text check (char_length(avatar_url) <= 2000),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: owner reads" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy "profiles: owner updates" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', new.email), 200),
    left(new.raw_user_meta_data ->> 'avatar_url', 2000)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Games: a save is the whole game state as JSON, plus a few columns the
-- "Continue" list reads without downloading every state.
-- ---------------------------------------------------------------------------
create table public.games (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scenario_id text not null check (scenario_id in ('1914', '1939', '1991', '2022')),
  player text not null check (char_length(player) between 1 and 80),
  -- A plain string or {"ru","uk","en"} — the country's name for the list.
  player_name jsonb not null,
  game_date date not null,
  turn integer not null check (turn >= 1),
  state jsonb not null check (pg_column_size(state) < 5 * 1024 * 1024),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index games_owner_updated_idx on public.games (owner, updated_at desc);

alter table public.games enable row level security;

create policy "games: owner reads" on public.games
  for select to authenticated using ((select auth.uid()) = owner);

create policy "games: owner inserts" on public.games
  for insert to authenticated with check ((select auth.uid()) = owner);

create policy "games: owner updates" on public.games
  for update to authenticated using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);

create policy "games: owner deletes" on public.games
  for delete to authenticated using ((select auth.uid()) = owner);

-- Row-level security does not cover TRUNCATE, so nobody but the owner role
-- gets it; anonymous visitors get nothing at all.
revoke all on public.games from anon;
revoke all on public.profiles from anon;
revoke truncate, references, trigger on public.games from authenticated;
revoke truncate, references, trigger on public.profiles from authenticated;
grant select, insert, update, delete on public.games to authenticated;
grant select, update on public.profiles to authenticated;
