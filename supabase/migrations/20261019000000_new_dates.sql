-- The dates added after the first schema (2014, then 1950, 1964 and 1999):
-- its check let cloud saves through only for 1914, 1939, 1991 and 2022.
alter table public.games drop constraint if exists games_scenario_id_check;
alter table public.games add constraint games_scenario_id_check
  check (scenario_id in ('1914', '1939', '1950', '1964', '1991', '1999', '2014', '2022'));
