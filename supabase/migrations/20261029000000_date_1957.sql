-- The ninth date, 4 October 1957: the check let cloud saves through only for
-- the eight dates before it.
alter table public.games drop constraint if exists games_scenario_id_check;
alter table public.games add constraint games_scenario_id_check
  check (scenario_id in ('1914', '1939', '1950', '1957', '1964', '1991', '1999', '2014', '2022'));
