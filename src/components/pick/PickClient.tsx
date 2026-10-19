"use client";

import { useRouter } from "next/navigation";
import { Flag, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import CountryFlag from "@/components/Flag";
import AppHeader from "@/components/AppHeader";
import CountryDetails from "@/components/game/CountryDetails";
import WorldMap from "@/components/map/WorldMap";
import { ui } from "@/components/ui/classes";
import { formatDate, yearOf } from "@/engine/calendar";
import { getScenario } from "@/engine/scenarios";
import { nationalAccounts, seedEconomies } from "@/engine/economy";
import { peopleByOwner } from "@/engine/provinces";
import { createGame, regionsByOwner, startingWorld } from "@/engine/setup";
import { tr } from "@/engine/text";
import type { ScenarioId } from "@/engine/types";
import { useI18n } from "@/i18n/useI18n";
import { useMap } from "@/lib/maps";
import { writeSave } from "@/lib/saves";

/** Pick a country for a scenario: the start-date map, a searchable list, the briefing. */
export default function PickClient({ scenarioId }: { scenarioId: ScenarioId }) {
  const router = useRouter();
  const { t, text, locale } = useI18n();
  const scenario = getScenario(scenarioId);
  const { map, error } = useMap(scenario.map);
  const [selected, setSelected] = useState<string | null>(scenario.featured[0] ?? null);
  const [query, setQuery] = useState("");
  const [starting, setStarting] = useState(false);

  // The starting world with every country's economy, as a new game will have it.
  const world = useMemo(
    () => (map ? seedEconomies({ ...startingWorld(scenario, map.regions), scenarioId: scenario.id }, map.index.regions) : null),
    [map, scenario],
  );
  const accounts = useMemo(
    () => (world && map ? nationalAccounts({ ...world, date: scenario.startDate }, map.index.regions) : null),
    [world, map, scenario],
  );
  const counts = useMemo(() => (world ? regionsByOwner(world) : new Map<string, string[]>()), [world]);
  const population = useMemo(() => (world ? peopleByOwner(world.regions, map?.index) : new Map<string, number>()), [world, map]);

  const groups = useMemo(() => {
    if (!world) return null;
    const q = query.trim().toLowerCase();
    const matches = (tag: string) => {
      const c = world.countries[tag];
      return !q || [tr(c.name, "en"), tr(c.name, locale), tag].some((s) => s.toLowerCase().includes(q));
    };
    const all = Object.keys(world.countries).filter(matches);
    const byName = (a: string, b: string) => text(world.countries[a].name).localeCompare(text(world.countries[b].name), locale);
    const featured = scenario.featured.filter((tag) => all.includes(tag));
    const dormant = all.filter((tag) => world.countries[tag].dormant && !featured.includes(tag)).sort(byName);
    const rest = all.filter((tag) => !featured.includes(tag) && !dormant.includes(tag)).sort(byName);
    return { featured, dormant, rest };
  }, [world, query, locale, scenario.featured, text]);

  const start = async () => {
    if (!map || !selected) return;
    setStarting(true);
    try {
      const state = createGame(scenario, map.regions, selected, new Date(), locale);
      await writeSave(state);
      router.push(`/play/${state.id}`);
    } catch {
      setStarting(false);
    }
  };

  const country = world && selected ? world.countries[selected] : null;

  const listButton = (tag: string) => {
    const c = world!.countries[tag];
    const active = tag === selected;
    return (
      <button
        key={tag}
        type="button"
        onClick={() => setSelected(tag)}
        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-bold transition-all ${
          active ? "bg-ink text-on-ink" : "text-ink hover:bg-warm"
        }`}
      >
        <CountryFlag tag={c.tag} scenario={scenario.id} color={c.color} size="sm" />
        <span className="min-w-0 flex-1 truncate">{text(c.name)}</span>
        <span className={`text-2xs tabular-nums ${active ? "text-on-ink/60" : "text-muted"}`}>{counts.get(tag)?.length ?? 0}</span>
      </button>
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader back="/" title={text(scenario.title)} subtitle={`${formatDate(scenario.startDate, locale)} · ${t("pick.title")}`} />

      <main className="mx-auto grid w-full max-w-[1600px] flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-h-0 flex-col gap-4">
          <div className={`${ui.card} relative aspect-[1000/540] w-full overflow-hidden`}>
            {map && world ? (
              <WorldMap
                topology={map.topology}
                regions={world.regions}
                countries={world.countries}
                selected={selected}
                era={scenario.id}
                year={yearOf(scenario.startDate)}
                onSelect={(tag) => tag && setSelected(tag)}
                className="h-full w-full"
              />
            ) : (
              <div className="grid h-full place-items-center text-sm font-medium text-muted">
                {error ? t("error.network_error") : (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("pick.loading")}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className={`${ui.card} p-5`}>
            <div className={`${ui.label} mb-2`}>{t("pick.briefing")}</div>
            <p className="text-sm font-medium leading-relaxed text-ink">{text(scenario.briefing)}</p>
            <p className="mt-3 text-xs font-medium text-muted">{t("pick.hint")}</p>
          </div>
        </div>

        <aside className="flex min-h-0 flex-col gap-4">
          {country && world && (
            <div className={`${ui.card} p-5`}>
              <CountryDetails
                country={country}
                scenario={scenario.id}
                regionCount={counts.get(country.tag)?.length ?? 0}
                population={population.get(country.tag) ?? 0}
                accounts={accounts?.get(country.tag)}
                detailed
                wars={scenario.wars.map((w) => ({ ...w }))}
                alliances={scenario.alliances.map((a) => ({ ...a }))}
                countries={world.countries}
                footer={
                  <button type="button" onClick={start} disabled={starting || !map} className={`${ui.primary} mt-1 w-full py-4 text-sm`}>
                    {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
                    {t("pick.start", { country: text(country.name) })}
                  </button>
                }
              />
            </div>
          )}

          <div className={`${ui.card} flex min-h-[320px] flex-1 flex-col overflow-hidden`}>
            <div className="border-b border-divider p-3">
              <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-page px-3 focus-within:border-ink focus-within:bg-surface">
                <Search className="h-4 w-4 text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("pick.search")}
                  className="w-full bg-transparent py-2.5 text-sm font-medium text-ink outline-none placeholder:text-gray-400"
                />
              </label>
            </div>
            <div className="flex-1 overflow-y-auto p-2 lg:max-h-[calc(100vh-30rem)]">
              {groups && (
                <>
                  {groups.featured.length > 0 && (
                    <>
                      <div className={`${ui.label} px-3 pt-2 pb-1`}>{t("pick.featured")}</div>
                      {groups.featured.map(listButton)}
                    </>
                  )}
                  {groups.dormant.length > 0 && (
                    <>
                      <div className={`${ui.label} px-3 pt-4 pb-1`}>{t("pick.dormant")}</div>
                      {groups.dormant.map(listButton)}
                    </>
                  )}
                  {groups.rest.length > 0 && (
                    <>
                      <div className={`${ui.label} px-3 pt-4 pb-1`}>{t("pick.all")}</div>
                      {groups.rest.map(listButton)}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
