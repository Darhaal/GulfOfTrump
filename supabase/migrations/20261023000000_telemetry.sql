-- Gulf of Trump — anonymous, opt-in telemetry.
--
-- The game sends a few anonymous events only when the player has said yes
-- (src/lib/telemetry/, docs/telemetry.md). A row carries a random id of the
-- installed copy, never an account, an e-mail or an IP address, and no text
-- the player or the model wrote: there is no column for any of it, and every
-- column is checked to the same shapes as the game's whitelist
-- (src/lib/telemetry/events.ts).
--
-- The public anon key may only insert. Nobody reads, changes or deletes rows
-- through the API; the owner reads them in the dashboard's SQL editor.

create table public.telemetry_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Common to every event.
  install_id uuid not null,
  event text not null check (event in ('app_start', 'game_start', 'game_load', 'turn_end', 'error', 'feature')),
  app_version text not null check (app_version ~ '^[0-9A-Za-z.+-]{1,32}$'),
  platform text not null check (platform in ('desktop', 'store', 'demo', 'web', 'dev')),
  locale text not null check (locale in ('ru', 'uk', 'en')),

  -- The game: its date, start ('eve', or null for the date's own day), the
  -- country's tag from the scenario's list, mode, role, and an anonymous key
  -- that cannot be matched to the save.
  scenario text check (scenario ~ '^[0-9]{4}$'),
  variant text check (variant ~ '^[a-z]{1,16}$'),
  country text check (country ~ '^[a-z][a-z0-9_-]{0,39}$'),
  mode text check (mode ~ '^[a-z]{1,16}$'),
  role text check (role ~ '^[a-z]{1,16}$'),
  game_key text check (game_key ~ '^[0-9a-f]{16}$'),

  -- A turn: its number, length, how long it took, its tokens, the model, and
  -- whether it succeeded or the error code.
  turn integer check (turn between 1 and 100000),
  turn_length text check (turn_length ~ '^[a-z]{1,16}$'),
  duration_ms integer check (duration_ms between 0 and 86400000),
  tokens_in integer check (tokens_in between 0 and 100000000),
  tokens_out integer check (tokens_out between 0 and 100000000),
  model text check (model ~ '^[a-z0-9][a-z0-9._:-]{0,63}$'),
  ok boolean,
  error_code text check (error_code ~ '^[a-z0-9_.-]{1,64}$'),

  -- A major panel or action that was used.
  feature text check (feature ~ '^[a-z0-9_]{1,32}$')
);

create index telemetry_events_created_idx on public.telemetry_events (created_at);
create index telemetry_events_event_created_idx on public.telemetry_events (event, created_at);

alter table public.telemetry_events enable row level security;

-- Insert only. With no select, update or delete policy, the API returns and
-- changes nothing; the game sends with `Prefer: return=minimal`.
create policy "telemetry: anyone inserts" on public.telemetry_events
  for insert to anon, authenticated with check (true);

revoke all on public.telemetry_events from anon, authenticated;
grant insert on public.telemetry_events to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Retention: rows older than twelve months are deleted every night by
-- pg_cron, which Supabase offers on every plan. The privacy policy promises
-- it (src/i18n/privacy.ts); check it with `select * from cron.job;`.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'telemetry-retention',
  '17 3 * * *',
  $$delete from public.telemetry_events where created_at < now() - interval '12 months'$$
);
