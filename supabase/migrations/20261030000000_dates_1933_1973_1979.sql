-- Three more dates, twelve in all: 30 January 1933, 6 October 1973 and
-- 25 December 1979. The check let cloud saves through only for the nine
-- dates before them.
alter table public.games drop constraint if exists games_scenario_id_check;
alter table public.games add constraint games_scenario_id_check
  check (scenario_id in ('1914', '1933', '1939', '1950', '1957', '1964', '1973', '1979', '1991', '1999', '2014', '2022'));
